const { Op } = require('sequelize');
const {
  sequelize,
  ServiceRequest,
  RequestStatusHistory,
  Department,
  College,
  User,
  Config,
} = require('../models');
const { createEventNotification } = require('./notificationService');

const DEFAULT_ESCALATION_HOURS = 72;
const ESCALATION_SCHEDULE = '* * * * *';
let scheduledTask = null;
let runInProgress = false;

const getEscalationHours = async () => {
  const record = await Config.findByPk('settings:dashboard');
  if (!record) return DEFAULT_ESCALATION_HOURS;

  let settings;
  try {
    settings = JSON.parse(record.value || '{}');
  } catch (error) {
    throw new Error('Dashboard escalation settings contain invalid JSON.');
  }

  const hours = Number(settings.escalationHours ?? DEFAULT_ESCALATION_HOURS);
  if (!Number.isInteger(hours) || hours < 1 || hours > 8760) {
    throw new Error('Dashboard escalation threshold must be an integer between 1 and 8760 hours.');
  }
  return hours;
};

const getEscalationRecipients = async (ticket) => {
  const [department, college, administrators] = await Promise.all([
    ticket.departmentId ? Department.findByPk(ticket.departmentId) : null,
    ticket.collegeId ? College.findByPk(ticket.collegeId) : null,
    User.findAll({ where: { role: 'admin', active: true }, attributes: ['id'] }),
  ]);
  const departmentHeadId = department?.headId ? Number(department.headId) : null;
  const collegeManagerId = college?.managerId ? Number(college.managerId) : null;
  const escalatedTo = departmentHeadId || collegeManagerId || null;
  const userIds = [...new Set([
    ticket.assignedTo,
    departmentHeadId,
    collegeManagerId,
    ...administrators.map((user) => user.id),
  ].map(Number).filter((id) => Number.isSafeInteger(id) && id > 0))];
  return { escalatedTo, userIds };
};

const notifyEscalation = async (ticket, userIds, escalationHours, notify) => {
  if (!userIds.length) {
    throw new Error(`Escalated service request ${ticket.id} has no active notification recipients.`);
  }
  const result = await notify({
    event: 'service_request_escalated',
    eventKey: `service_request_escalated:${ticket.id}`,
    entityId: ticket.id,
    entityType: 'service_request',
    departmentId: ticket.departmentId,
    userIds,
    title: 'Service request escalated',
    message: `Service request ${ticket.requestCode} was automatically escalated after ${escalationHours} hours without acknowledgement.`,
    type: 'maintenance',
    priority: 'high',
  });
  if (result.skipped && result.reason !== 'no_recipients') {
    console.error(`Escalation notification for service request ${ticket.id} was skipped: ${result.reason}.`);
  }
};

const runServiceRequestEscalation = async (now = new Date(), notify = createEventNotification) => {
  if (runInProgress) return { escalated: [], escalationHours: await getEscalationHours(), skipped: true };
  runInProgress = true;
  try {
    const escalationHours = await getEscalationHours();
    const cutoff = new Date(now.getTime() - escalationHours * 60 * 60 * 1000);
    const overdueTickets = await ServiceRequest.findAll({
      where: {
        acknowledgedAt: null,
        escalated: false,
        status: 'submitted',
        createdAt: { [Op.lte]: cutoff },
      },
      attributes: ['id'],
      order: [['createdAt', 'ASC']],
    });
    const escalated = [];

    for (const candidate of overdueTickets) {
      const transaction = await sequelize.transaction();
      try {
        const ticket = await ServiceRequest.findOne({
          where: {
            id: candidate.id,
            acknowledgedAt: null,
            escalated: false,
            status: 'submitted',
            createdAt: { [Op.lte]: cutoff },
          },
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        if (!ticket) {
          await transaction.commit();
          continue;
        }

        const { escalatedTo, userIds } = await getEscalationRecipients(ticket);
        const escalatedAt = new Date(now);
        await ticket.update({
          status: 'escalated',
          escalated: true,
          escalatedAt,
          escalatedTo,
          escalationReason: `Automatic escalation: not acknowledged within ${escalationHours} hours`,
        }, { transaction });
        await RequestStatusHistory.create({
          requestId: ticket.id,
          previousStatus: 'submitted',
          newStatus: 'escalated',
          changedBy: null,
          comment: `Automatically escalated after ${escalationHours} hours without acknowledgement`,
        }, { transaction });
        await transaction.commit();

        escalated.push({ ticket, userIds });
      } catch (error) {
        if (!transaction.finished) await transaction.rollback();
        throw error;
      }
    }

    const notificationFailures = [];
    for (const { ticket, userIds } of escalated) {
      try {
        await notifyEscalation(ticket, userIds, escalationHours, notify);
      } catch (error) {
        console.error(`Escalation notification failed for service request ${ticket.id}:`, error.stack || error);
        notificationFailures.push({ ticketId: ticket.id, message: error.message });
      }
    }
    return { escalated: escalated.map(({ ticket }) => ticket), escalationHours, notificationFailures };
  } finally {
    runInProgress = false;
  }
};

const startServiceRequestEscalationScheduler = () => {
  if (scheduledTask) return scheduledTask;
  try {
    const cron = require('node-cron');
    scheduledTask = cron.schedule(ESCALATION_SCHEDULE, async () => {
      try {
        const result = await runServiceRequestEscalation();
        if (result.escalated.length) {
          console.log(`Automatically escalated ${result.escalated.length} service request(s).`);
        }
      } catch (error) {
        console.error('Service request escalation failed:', error.stack || error);
      }
    }, { timezone: process.env.TZ || 'UTC' });
    runServiceRequestEscalation().catch((error) => {
      console.error('Initial service request escalation run failed:', error.stack || error);
    });
    return scheduledTask;
  } catch (error) {
    console.error('Service request escalation scheduler could not start:', error.stack || error);
    return null;
  }
};

module.exports = {
  DEFAULT_ESCALATION_HOURS,
  getEscalationHours,
  runServiceRequestEscalation,
  startServiceRequestEscalationScheduler,
};
