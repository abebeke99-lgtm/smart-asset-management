const getAdministratorAssignmentError = ({
  actorId,
  targetUserId,
  wasAdministrator,
  willBeAdministrator,
  activeAdministratorCount,
}) => {
  if (
    Number(actorId) === Number(targetUserId)
    && wasAdministrator
    && !willBeAdministrator
  ) {
    return {
      status: 403,
      message: 'You cannot remove your own Administrator access.',
      reason: 'users cannot remove their own Administrator role',
    };
  }

  if (wasAdministrator && !willBeAdministrator && activeAdministratorCount <= 1) {
    return {
      status: 409,
      message: 'The last Administrator cannot lose the Administrator role.',
      reason: 'last Administrator protection',
    };
  }
  return null;
};

module.exports = { getAdministratorAssignmentError };
