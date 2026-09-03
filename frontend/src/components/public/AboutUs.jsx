import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage, useTheme } from '../../contexts/UiContext';
import { Target, Eye, Shield, Users, Zap, Package, Search, Wrench, BarChart3, Lock, UserCheck, Database, Route, ClipboardCheck } from 'lucide-react';

const AboutUs = () => {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const t = language === 'en' ? {
    pageTitle: 'About Us',
    pageSubtitle: 'Learn about our mission, vision, and the team behind Mekdela Amba University\'s Smart Asset Management System',
    missionTitle: '🎯 Our Mission',
    missionText: 'To provide a comprehensive, efficient, and transparent asset management system for Mekdela Amba University using modern technologies. We aim to streamline asset tracking, maintenance, and reporting to enhance operational efficiency and accountability.',
    visionTitle: '👁️ Our Vision',
    visionText: 'To be a leading provider of integrated asset management solutions that empowers educational institutions to manage their resources effectively, securely, and sustainably.',
    valuesTitle: '💎 Core Values',
    innovationTitle: 'Innovation',
    innovationDesc: 'Constantly improving and adopting new technologies',
    collaborationTitle: 'Collaboration',
    collaborationDesc: 'Working together with stakeholders for mutual success',
    excellenceTitle: 'Excellence',
    excellenceDesc: 'Delivering high-quality solutions with attention to detail',
    securityTitle: 'Security',
    securityDesc: 'Protecting user data and system integrity always',
    technologyTitle: '🛠️ Technology Stack',
    teamTitle: '👥 Our Team',
    teamDesc: 'Dedicated professionals committed to excellence and innovation',
    leadDeveloper: 'Lead Developer',
    developmentTeam: 'Development Team',
    keyFeaturesTitle: 'Why Choose Us?',
    feature1: 'Centralized Asset Management',
    feature1Desc: 'All your assets in one secure, accessible platform',
    feature2: 'Real-time Tracking',
    feature2Desc: 'Track asset locations and status in real-time',
    feature3: 'Comprehensive Reporting',
    feature3Desc: 'Generate detailed reports and analytics',
    feature4: 'Secure & Compliant',
    feature4Desc: 'Secure authentication, protected routes, and audit trails',
    feature5: 'Role-based Access',
    feature5Desc: 'Granular permissions for different user roles',
    feature6: 'Mobile Ready',
    feature6Desc: 'Access the system from any device'
  } : {
    pageTitle: 'ስለ እኛ',
    pageSubtitle: 'የመቅደላ አምባ ዩኒቨርሲቲ ስማርት ንብረት አስተዳደር ስርዓት ስለ ተልእኮ ፣ ራዕይ እና ከ‐后ስቀምጠሉት ሰራተኞች ይወቁ',
    missionTitle: '🎯 ተልእኮ',
    missionText: 'ለመቅደላ አምባ ዩኒቨርሲቲ ዘመናዊ ቴክኖሎጂዎችን በመጠቀም አጠቃላይ፣ ቅልጅተማ ምግብር እና ግላዊ ንብረት አስተዳደር ስርዓት ማቅረብ። ንብረት ክትትል ፣ ጥገና እና ሪፖርትን ለማቀላጠፍ ዓላማ ያለብን ለክወናዊ ብቃት እና ተሕትሞ.',
    visionTitle: '👁️ ራዕይ',
    visionText: 'ትምህርት ተቋማትን ሃብታቸውን በብቃት ፣ ደህንነቱ ተጠብቆ እና በቀጣይነት ለማስተዳደር ኃይል ሰጪ አጠቃላይ ንብረት አስተዳደር መፍትሔዎች ታቅዱ ፊታ ታዳሚ ጣፋጭ ዓስተዋዋቂ ስርዓት ሆን ክብደት ሊይ ታዩት ተግባር ሊውል ይሊይ።',
    valuesTitle: '💎 ዋና ዋጋዎች',
    innovationTitle: 'ፈጠራ',
    innovationDesc: 'ሁልጊዜ ማሻሻል እና አዲስ ቴክኖሎጂዎችን ይቀበሉ',
    collaborationTitle: 'ትብብር',
    collaborationDesc: 'ለተጋጣሚ ሰፊ ስኬት ከወገኖች ጋር መስራት',
    excellenceTitle: 'ብልጽግና',
    excellenceDesc: 'በከፍተኛ ጥራት ያላቸው መፍትሔዎች ልክ ዝርዝር ይስጥ',
    securityTitle: 'ደህንነት',
    securityDesc: 'ተጠቃሚ ውሂብ እና ስርዓተ-ብክነቱ ሁል ጊዜ ይጠበቁ',
    technologyTitle: '🛠️ ቴክኖሎጂ ረድፍ',
    teamTitle: '👥 ሰራተኞቻችን',
    teamDesc: 'ብልጽግና እና ፈጠራ ላይ ምኞት ያላቸው ተወዳዳሪ ሙያተኞች',
    leadDeveloper: 'ዋና ገንቢ',
    developmentTeam: 'የልማት ቡድን',
    keyFeaturesTitle: 'ሙያ ለምን እኛን ይምረጡ?',
    feature1: 'ማዕከላዊ ንብረት አስተዳደር',
    feature1Desc: 'ሁሉንም ንብረቶችዎ በአንድ ደህንነቱ ተጠብቆ ሊደረሳ ወደሚችል መድረክ',
    feature2: 'በእውነት ጊዜ ክትትል',
    feature2Desc: 'የንብረቶች ቦታ እና ሁኔታ በእውነት ጊዜ ይከታተሉ',
    feature3: 'ሙሉ ሪፖርትስ',
    feature3Desc: 'ዝርዝር ሪፖርቶች እና ትንታኔዎች ያዘጋጁ',
    feature4: 'ደህንነታማ እና ተኳምር',
    feature4Desc: 'ደህንነቱ የተጠበቀ ማረጋገጫ፣ የተጠበቁ መንገዶች እና የእንቅስቃሴ መዝገቦች',
    feature5: 'በሚና ላይ የተመሰረተ መዳረሻ',
    feature5Desc: 'የተለያዩ ተጠቃሚ ሚናዎች ሊስቱ ግብይት',
    feature6: 'ሞባይል ዝግጅት',
    feature6Desc: 'ከማንኛውም መሳሪያ ስርዓተን ይድረሱ'
  };

  const values = [
    { icon: Target, title: t.innovationTitle, desc: t.innovationDesc, color: '#3b82f6' },
    { icon: Users, title: t.collaborationTitle, desc: t.collaborationDesc, color: '#10b981' },
    { icon: Zap, title: t.excellenceTitle, desc: t.excellenceDesc, color: '#f59e0b' },
    { icon: Shield, title: t.securityTitle, desc: t.securityDesc, color: '#ef4444' }
  ];

  const features = [
    { title: t.feature1, desc: t.feature1Desc, icon: '📦' },
    { title: t.feature2, desc: t.feature2Desc, icon: '📡' },
    { title: t.feature3, desc: t.feature3Desc, icon: '📊' },
    { title: t.feature4, desc: t.feature4Desc, icon: '🔒' },
    { title: t.feature5, desc: t.feature5Desc, icon: '👥' },
    { title: t.feature6, desc: t.feature6Desc, icon: '📱' }
  ];

  const purposeItems = [
    { icon: Package, title: 'Better Asset Control', text: 'Centralize asset registration, assignment, and operational records.' },
    { icon: Search, title: 'Improved Visibility', text: 'See asset status, ownership, inventory, and department information.' },
    { icon: Wrench, title: 'Efficient Maintenance', text: 'Track maintenance requests, assigned work, status, and history.' },
    { icon: BarChart3, title: 'Better Decisions', text: 'Use structured reports and financial information for informed decisions.' }
  ];

  const workflowItems = [
    { number: '01', icon: Package, title: 'Register Asset', text: 'Create a complete asset record.' },
    { number: '02', icon: UserCheck, title: 'Assign Asset', text: 'Link assets to people or departments.' },
    { number: '03', icon: Search, title: 'Track & Monitor', text: 'Follow status, inventory, and activity.' },
    { number: '04', icon: Wrench, title: 'Maintain & Update', text: 'Manage requests and maintenance history.' },
    { number: '05', icon: BarChart3, title: 'Report & Analyze', text: 'Review structured reports and insights.' }
  ];

  const roleItems = [
    ['👑', 'Admin', 'Manage users, system configuration, and overall administration.'],
    ['📦', 'Store Manager', 'Manage inventory, assets, assignments, and store operations.'],
    ['💻', 'ICT Officer', 'Manage technology assets and ICT-related asset operations.'],
    ['📋', 'College Head', 'Review and manage college assets and approvals.'],
    ['💰', 'Finance', 'Monitor financial asset information and reporting.'],
    ['🔧', 'Maintenance', 'Manage maintenance requests, tasks, and asset maintenance history.']
  ];

  const benefitItems = [
    ['📈', 'Improved Efficiency', 'Reduce manual asset-management work.'],
    ['🔐', 'Better Accountability', 'Maintain clear records of asset ownership and activity.'],
    ['📊', 'Better Reporting', 'Access structured reports and analytics.'],
    ['🔧', 'Faster Maintenance', 'Track maintenance requests and status.'],
    ['📍', 'Better Asset Visibility', 'Improve awareness of asset location and status.'],
    ['👥', 'Department Coordination', 'Support collaboration across university departments.']
  ];

  const securityItems = [
    { icon: Lock, title: 'Authentication', text: 'Secure user authentication with JWT-based sessions.' },
    { icon: Users, title: 'Role-Based Access', text: 'Different dashboards and permissions are assigned by role.' },
    { icon: ClipboardCheck, title: 'Audit / Activity Tracking', text: 'Authentication and important system activity are recorded in audit logs.' },
    { icon: Route, title: 'Protected Routes', text: 'Authenticated users access protected system areas through route guards.' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <main style={{ flex: 1 }}>
        {/* Hero Section */}
        <section style={{
          background: isDark
            ? 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f4c75 100%)'
            : 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 50%, #1e40af 100%)',
          color: 'white',
          padding: '80px 20px',
          textAlign: 'center',
          animation: 'fadeIn 0.8s ease forwards'
        }}>
          <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <div className="about-hero-icon" aria-hidden="true"><Database size={32} /></div>
            <h1 style={{
              fontSize: '2.8rem',
              fontWeight: 900,
              marginBottom: '16px',
              animation: 'slideUp 0.8s ease forwards'
            }}>
              {t.pageTitle}
            </h1>
            <p style={{
              fontSize: '1.2rem',
              opacity: 0.95,
              animation: 'slideUp 0.8s ease 0.1s forwards',
              animationFillMode: 'both'
            }}>
              {t.pageSubtitle}
            </p>
          </div>
        </section>

        {/* Mission & Vision */}
        <section className="about-mission-vision" style={{
          maxWidth: '1200px',
          margin: '60px auto',
          padding: '0 20px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
          gap: '32px'
        }}>
          <div style={{
            background: isDark ? '#1e293b' : '#ffffff',
            padding: '40px 32px',
            borderRadius: '16px',
            border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
            animation: 'slideUp 0.6s ease forwards'
          }}>
            <h2 style={{
              fontSize: '1.8rem',
              fontWeight: 800,
              marginBottom: '16px',
              color: isDark ? '#f1f5f9' : '#0f172a'
            }}>
              {t.missionTitle}
            </h2>
            <p style={{
              color: isDark ? '#cbd5e1' : '#475569',
              lineHeight: 1.8,
              fontSize: '1rem'
            }}>
              {t.missionText}
            </p>
          </div>

          <div style={{
            background: isDark ? '#1e293b' : '#ffffff',
            padding: '40px 32px',
            borderRadius: '16px',
            border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
            animation: 'slideUp 0.6s ease 0.1s forwards',
            animationFillMode: 'both'
          }}>
            <h2 style={{
              fontSize: '1.8rem',
              fontWeight: 800,
              marginBottom: '16px',
              color: isDark ? '#f1f5f9' : '#0f172a'
            }}>
              {t.visionTitle}
            </h2>
            <p style={{
              color: isDark ? '#cbd5e1' : '#475569',
              lineHeight: 1.8,
              fontSize: '1rem'
            }}>
              {t.visionText}
            </p>
          </div>
        </section>

        {/* Core Values */}
        <section style={{
          maxWidth: '1200px',
          margin: '80px auto',
          padding: '0 20px'
        }}>
          <h2 style={{
            fontSize: '2.2rem',
            fontWeight: 800,
            textAlign: 'center',
            marginBottom: '48px',
            color: isDark ? '#f1f5f9' : '#0f172a'
          }}>
            {t.valuesTitle}
          </h2>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '24px'
          }}>
            {values.map((value, idx) => {
              const IconComponent = value.icon;
              return (
                <div
                  key={idx}
                  style={{
                    background: isDark ? '#1e293b' : '#ffffff',
                    padding: '32px 24px',
                    borderRadius: '16px',
                    textAlign: 'center',
                    border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                    animation: `slideUp 0.6s ease ${idx * 0.1}s forwards`,
                    animationFillMode: 'both',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-8px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <div style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '12px',
                    background: `${value.color}15`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 16px'
                  }}>
                    <IconComponent size={32} color={value.color} />
                  </div>
                  <h3 style={{
                    fontSize: '1.2rem',
                    fontWeight: 700,
                    marginBottom: '12px',
                    color: isDark ? '#f1f5f9' : '#0f172a'
                  }}>
                    {value.title}
                  </h3>
                  <p style={{
                    color: isDark ? '#cbd5e1' : '#475569',
                    fontSize: '0.95rem',
                    lineHeight: 1.6,
                    margin: 0
                  }}>
                    {value.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Why We Built This System */}
        <section className="about-section about-purpose">
          <div className="about-section-heading"><span className="about-kicker">Purpose</span><h2>Why We Built This System</h2><p>The Smart University Asset Management System was designed to help university departments manage assets more efficiently, improve accountability, simplify maintenance workflows, and provide better visibility into institutional resources.</p></div>
          <div className="about-grid about-grid-four">{purposeItems.map(({ icon: Icon, title, text }) => <article className="about-mini-card" key={title}><Icon size={28} aria-hidden="true" /><h3>{title}</h3><p>{text}</p></article>)}</div>
        </section>

        {/* How It Works */}
        <section className="about-section">
          <div className="about-section-heading"><span className="about-kicker">Workflow</span><h2>How It Works</h2><p>A clear path from asset registration to useful reporting.</p></div>
          <div className="about-workflow">{workflowItems.map(({ number, icon: Icon, title, text }, index) => <article className="about-workflow-step" key={number}><span className="about-step-number">{number}</span><Icon size={28} aria-hidden="true" /><h3>{title}</h3><p>{text}</p>{index < workflowItems.length - 1 && <span className="about-step-arrow" aria-hidden="true">→</span>}</article>)}</div>
        </section>

        {/* User Roles */}
        <section className="about-section about-band">
          <div className="about-section-heading"><span className="about-kicker">People and permissions</span><h2>Built for Every University Department</h2><p>Each role has a focused workspace for the operations it is responsible for.</p></div>
          <div className="about-grid about-grid-three">{roleItems.map(([icon, title, text]) => <article className="about-role-card" key={title}><span className="about-emoji" aria-hidden="true">{icon}</span><h3>{title}</h3><p>{text}</p></article>)}</div>
        </section>

        {/* Key Features */}
        <section style={{
          maxWidth: '1200px',
          margin: '80px auto',
          padding: '0 20px'
        }}>
          <h2 style={{
            fontSize: '2.2rem',
            fontWeight: 800,
            textAlign: 'center',
            marginBottom: '48px',
            color: isDark ? '#f1f5f9' : '#0f172a'
          }}>
            {t.keyFeaturesTitle}
          </h2>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '24px'
          }}>
            {features.map((feature, idx) => (
              <div
                key={idx}
                style={{
                  background: isDark ? '#1e293b' : '#ffffff',
                  padding: '28px 24px',
                  borderRadius: '12px',
                  border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                  animation: `slideUp 0.6s ease ${idx * 0.08}s forwards`,
                  animationFillMode: 'both',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div style={{ fontSize: '2.4rem', marginBottom: '12px' }}>
                  {feature.icon}
                </div>
                <h3 style={{
                  fontSize: '1.1rem',
                  fontWeight: 700,
                  marginBottom: '8px',
                  color: isDark ? '#f1f5f9' : '#0f172a'
                }}>
                  {feature.title}
                </h3>
                <p style={{
                  color: isDark ? '#cbd5e1' : '#475569',
                  fontSize: '0.9rem',
                  lineHeight: 1.6,
                  margin: 0
                }}>
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Benefits */}
        <section className="about-section">
          <div className="about-section-heading"><span className="about-kicker">Outcomes</span><h2>Benefits for Mekdela Amba University</h2></div>
          <div className="about-grid about-grid-three">{benefitItems.map(([icon, title, text]) => <article className="about-benefit-card" key={title}><span className="about-emoji" aria-hidden="true">{icon}</span><div><h3>{title}</h3><p>{text}</p></div></article>)}</div>
        </section>

        {/* Technology */}
        <section className="about-section about-tech-band">
          <div className="about-section-heading"><span className="about-kicker">Implementation</span><h2>Technology Behind the System</h2><p>Technologies verified in the current project implementation.</p></div>
          <div className="about-tech-list">{[['React', 'Frontend interface'], ['Node.js', 'Backend runtime'], ['Express', 'HTTP API server'], ['REST API', 'Frontend-backend communication'], ['MySQL + Sequelize', 'Relational database and ORM'], ['JWT + Passport', 'Authentication and protected access']].map(([title, text]) => <article key={title}><Database size={22} aria-hidden="true" /><h3>{title}</h3><p>{text}</p></article>)}</div>
        </section>

        {/* Security */}
        <section className="about-section">
          <div className="about-section-heading"><span className="about-kicker">Trust and access</span><h2>Security &amp; Access Control</h2></div>
          <div className="about-grid about-grid-four">{securityItems.map(({ icon: Icon, title, text }) => <article className="about-mini-card" key={title}><Icon size={28} aria-hidden="true" /><h3>{title}</h3><p>{text}</p></article>)}</div>
        </section>

        {/* System Workflow Visual */}
        <section className="about-section about-system-flow">
          <div className="about-section-heading"><span className="about-kicker">System flow</span><h2>From Login to Reporting</h2></div>
          <div className="about-flow-line">{[['USER', Users], ['LOGIN', Lock], ['ROLE DETECTION', UserCheck], ['ROLE DASHBOARD', Route], ['ASSET OPERATIONS', Package], ['REPORTING', BarChart3]].map(([label, Icon], index) => <React.Fragment key={label}><div className="about-flow-node"><Icon size={22} aria-hidden="true" /><span>{label}</span></div>{index < 5 && <span className="about-flow-arrow" aria-hidden="true">→</span>}</React.Fragment>)}</div>
        </section>

        {/* CTA Section */}
        <section style={{
          maxWidth: '900px',
          margin: '80px auto',
          padding: '60px 40px',
          background: isDark
            ? 'linear-gradient(135deg, #1e293b, #0f172a)'
            : 'linear-gradient(135deg, #f0f9ff, #e0f2fe)',
          borderRadius: '20px',
          textAlign: 'center',
          border: `1px solid ${isDark ? '#334155' : '#bae6fd'}`,
          animation: 'slideUp 0.8s ease 0.3s forwards',
          animationFillMode: 'both'
        }}>
          <h2 style={{
            fontSize: '2rem',
            fontWeight: 800,
            marginBottom: '16px',
            color: isDark ? '#f1f5f9' : '#0f172a'
          }}>
            Ready to Get Started?
          </h2>
          
          <p style={{
            fontSize: '1.1rem',
            color: isDark ? '#cbd5e1' : '#475569',
            marginBottom: '32px'
          }}>
            Start using the Smart University Asset Management System to manage university resources more efficiently.
          </p>

          <Link
            to="/login"
            style={{
              padding: '16px 48px',
              background: 'linear-gradient(135deg, #2563eb, #1e40af)',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '12px',
              fontWeight: 700,
              fontSize: '1.1rem',
              transition: 'all 0.3s ease',
              border: 'none',
              cursor: 'pointer',
              display: 'inline-block'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 20px 40px rgba(37, 99, 235, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            Get Started Now
          </Link>
        </section>
      </main>

      <style>{`
        .about-section { max-width: 1200px; margin: 80px auto; padding: 0 20px; }
        .about-hero-icon { display: grid; place-items: center; width: 64px; height: 64px; margin: 0 auto 18px; border: 1px solid rgba(255,255,255,.45); border-radius: 16px; background: rgba(255,255,255,.14); animation: iconFloat 3s ease-in-out infinite; }
        .about-section-heading { max-width: 820px; margin: 0 auto 40px; text-align: center; }
        .about-section-heading h2 { margin: 8px 0 14px; color: ${isDark ? '#f1f5f9' : '#0f172a'}; font-size: 2.2rem; font-weight: 800; }
        .about-section-heading p { color: ${isDark ? '#cbd5e1' : '#475569'}; line-height: 1.75; }
        .about-kicker { color: #2563eb; font-size: .75rem; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
        .about-grid { display: grid; gap: 24px; }
        .about-grid-four { grid-template-columns: repeat(4, minmax(0, 1fr)); }
        .about-grid-three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .about-mini-card, .about-role-card, .about-benefit-card, .about-tech-list article { padding: 26px 22px; border: 1px solid ${isDark ? '#334155' : '#e2e8f0'}; border-radius: 12px; background: ${isDark ? '#1e293b' : '#fff'}; transition: transform .25s ease, box-shadow .25s ease; }
        .about-mini-card:hover, .about-role-card:hover, .about-benefit-card:hover, .about-tech-list article:hover { transform: translateY(-6px); box-shadow: 0 16px 30px rgba(15, 23, 42, .12); }
        .about-mini-card svg { color: #2563eb; margin-bottom: 14px; }
        .about-mini-card h3, .about-role-card h3, .about-benefit-card h3, .about-tech-list h3 { margin: 0 0 9px; color: ${isDark ? '#f1f5f9' : '#0f172a'}; font-size: 1.05rem; }
        .about-mini-card p, .about-role-card p, .about-benefit-card p, .about-tech-list p { margin: 0; color: ${isDark ? '#cbd5e1' : '#475569'}; line-height: 1.65; }
        .about-band, .about-tech-band { max-width: none; padding: 80px max(20px, calc((100% - 1160px) / 2)); background: ${isDark ? '#162338' : '#f8fafc'}; }
        .about-emoji { display: block; margin-bottom: 14px; font-size: 2rem; }
        .about-workflow { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 14px; }
        .about-workflow-step { position: relative; padding: 22px 16px; border-top: 3px solid #2563eb; background: ${isDark ? '#1e293b' : '#fff'}; text-align: center; }
        .about-workflow-step svg { display: block; margin: 12px auto; color: #2563eb; }
        .about-step-number { color: #2563eb; font-size: .8rem; font-weight: 800; letter-spacing: .1em; }
        .about-workflow-step h3 { color: ${isDark ? '#f1f5f9' : '#0f172a'}; font-size: 1rem; }
        .about-workflow-step p { color: ${isDark ? '#cbd5e1' : '#64748b'}; font-size: .88rem; line-height: 1.5; }
        .about-step-arrow { position: absolute; top: 50%; right: -18px; z-index: 1; color: #2563eb; font-size: 1.5rem; }
        .about-benefit-card { display: flex; gap: 15px; align-items: flex-start; }
        .about-tech-list { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; }
        .about-tech-list article { display: grid; grid-template-columns: auto 1fr; column-gap: 12px; }
        .about-tech-list article svg { grid-row: span 2; color: #2563eb; }
        .about-flow-line { display: flex; align-items: center; justify-content: center; gap: 12px; flex-wrap: wrap; }
        .about-flow-node { display: flex; align-items: center; gap: 8px; padding: 13px 15px; border: 1px solid ${isDark ? '#334155' : '#dbe4f0'}; border-radius: 9px; background: ${isDark ? '#1e293b' : '#fff'}; color: ${isDark ? '#f1f5f9' : '#17305f'}; font-size: .78rem; font-weight: 800; }
        .about-flow-node svg { color: #2563eb; }
        .about-flow-arrow { color: #2563eb; font-size: 1.4rem; }
        @media (max-width: 900px) { .about-grid-four, .about-tech-list { grid-template-columns: repeat(2, minmax(0, 1fr)); } .about-grid-three { grid-template-columns: repeat(2, minmax(0, 1fr)); } .about-workflow { grid-template-columns: repeat(2, minmax(0, 1fr)); } .about-step-arrow { display: none; } }
        @media (max-width: 600px) { .about-section { margin: 56px auto; padding: 0 16px; } .about-section-heading h2 { font-size: 1.75rem; } .about-mission-vision { grid-template-columns: 1fr !important; } .about-mission-vision > div { min-width: 0; } .about-grid-four, .about-grid-three, .about-tech-list, .about-workflow { grid-template-columns: 1fr; } .about-band, .about-tech-band { padding: 56px 16px; } .about-flow-line { flex-direction: column; } .about-flow-arrow { transform: rotate(90deg); } }
        @media (prefers-reduced-motion: reduce) { .about-mini-card, .about-role-card, .about-benefit-card, .about-tech-list article { transition: none; } }
        @media (prefers-reduced-motion: reduce) { .about-hero-icon { animation: none; } }
        @keyframes iconFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 0.01ms !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
    </div>
  );
};

export default AboutUs;
