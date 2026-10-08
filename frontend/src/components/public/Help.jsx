import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useLanguage, useTheme } from '../../contexts/UiContext';

const Help = () => {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const [query, setQuery] = useState('');
  const [openFaqId, setOpenFaqId] = useState(null);
  const isEnglish = language === 'en';
  const text = (english, amharic) => (isEnglish ? english : amharic);

  const questions = [
    [text('How do I register an asset?', 'ንብረት እንዴት እመዘግባለሁ?'), text('Open the asset registration workflow available to your role and enter the required asset information.', 'በሚናዎ የሚገኘውን የንብረት መመዝገቢያ ሂደት ይክፈቱና የሚያስፈልገውን መረጃ ያስገቡ።')],
    [text('How do I find an asset?', 'ንብረትን እንዴት አገኛለሁ?'), text('Use the asset search or filtering tools available in your dashboard.', 'በዳሽቦርድዎ ያሉትን የንብረት ፍለጋ ወይም ማጣሪያ መሣሪያዎች ይጠቀሙ።')],
    [text('What can a Department Head see on Department Assets?', 'የክፍል ኃላፊ በክፍል ንብረቶች ላይ ምን ማየት ይችላል?'), text('Department Heads can view only assets authorized for their department. Select an asset to see its Asset ID, Digital ID, name, category, serial number, quantity, status, condition, location, assigned user, purchase date, warranty, QR Code, RFID, and maintenance status. Use search, filters, or QR identification to find an asset.', 'የክፍል ኃላፊዎች ለክፍላቸው የተፈቀዱ ንብረቶችን ብቻ ማየት ይችላሉ። ንብረቱን በመምረጥ የንብረት መለያ፣ ዲጂታል መለያ፣ ስም፣ ምድብ፣ ተከታታይ ቁጥር፣ ብዛት፣ ሁኔታ፣ ጥራት፣ ቦታ፣ የተመደበለት ተጠቃሚ፣ የግዢ ቀን፣ ዋስትና፣ QR ኮድ፣ RFID መለያ እና የጥገና ሁኔታ ይመልከቱ። ንብረት ለማግኘት ፍለጋ፣ ማጣሪያ ወይም QR መለያ መለየትን ይጠቀሙ።')],
    [text('How do I check inventory status?', 'የኢንቬንተሪ ሁኔታን እንዴት አያለሁ?'), text('Open the inventory area available to your role and review available quantities and asset records.', 'በሚናዎ የሚገኘውን የኢንቬንተሪ ክፍል ይክፈቱና የሚገኙ ብዛቶችንና የንብረት መዝገቦችን ይመልከቱ።')],
    [text('How do I assign an asset?', 'ንብረትን እንዴት እመድባለሁ?'), text('Use the asset assignment workflow available to your role and provide the required assignment information.', 'በሚናዎ የሚገኘውን የንብረት ምደባ ሂደት ይጠቀሙና የሚያስፈልገውን የምደባ መረጃ ያስገቡ።')],
    [text('How do I request a transfer?', 'የዝውውር ጥያቄ እንዴት አቀርባለሁ?'), text('Open Transfers from your dashboard and submit the asset, destination, and reason through the workflow available to your role.', 'ከዳሽቦርድዎ ዝውውሮችን ይክፈቱና በሚናዎ በሚገኘው ሂደት ንብረቱን፣ መድረሻውንና ምክንያቱን ያስገቡ።')],
    [text('How do I verify an asset?', 'ንብረትን እንዴት አረጋግጣለሁ?'), text('Open the verification workflow available to your role and record the physical verification results.', 'በሚናዎ የሚገኘውን የማረጋገጫ ሂደት ይክፈቱና የአካላዊ ማረጋገጫ ውጤቶችን ይመዝግቡ።')],
    [text('How do I report a maintenance issue?', 'የጥገና ችግርን እንዴት እዘግባለሁ?'), text('Use the maintenance request workflow available to your role and provide the required asset and maintenance information.', 'በሚናዎ የሚገኘውን የጥገና ጥያቄ ሂደት ይጠቀሙና የሚያስፈልገውን የንብረትና የጥገና መረጃ ያስገቡ።')],
    [text('How do I return an asset?', 'ንብረትን እንዴት እመልሳለሁ?'), text('Use the asset return workflow available to your role and complete the required return information.', 'በሚናዎ የሚገኘውን የንብረት መመለሻ ሂደት ይጠቀሙና የሚያስፈልገውን የመመለሻ መረጃ ያስገቡ።')],
    [text('How do I request asset disposal?', 'የንብረት ማስወገድ ጥያቄ እንዴት አቀርባለሁ?'), text('Use the disposal workflow available to your role if your account has permission to request or manage disposal.', 'መለያዎ ማስወገድን ለመጠየቅ ወይም ለማስተዳደር ፈቃድ ካለው በሚናዎ የሚገኘውን የማስወገድ ሂደት ይጠቀሙ።')]
  ];

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredQuestions = questions.filter(([question, answer]) =>
    `${question} ${answer}`.toLocaleLowerCase().includes(normalizedQuery)
  );

  const handleSearch = (event) => {
    event.preventDefault();
    setOpenFaqId(null);
  };

  return (
    <main className={`help-page${theme === 'dark' ? ' help-page-dark' : ''}`}>
      <style>{`
        .help-page { --help-primary: #315D82; --help-secondary: #4F7597; --help-accent: #315D82; --help-bg: #FFFFFF; --help-card: #FFFFFF; --help-text: #0F1F2E; --help-muted: #304B65; --help-border: #D7E1EA; --help-page-bg: var(--help-bg); --help-surface: var(--help-card); --help-text-main: var(--help-text); --help-text-soft: var(--help-muted); --help-outline: var(--help-border); --help-brand: var(--help-primary); --help-brand-alt: var(--help-secondary); --help-highlight: var(--help-accent); background: var(--help-page-bg); color: var(--help-text-main); min-height: 100%; }
        .help-page-dark { --help-page-bg: #0f172a; --help-surface: #111c2c; --help-text-main: #e2e8f0; --help-text-soft: #a7b3c7; --help-outline: rgba(148,163,184,0.22); --help-brand: #93c5fd; --help-brand-alt: #cbd5e1; --help-highlight: #315D82; }
        .help-page, .help-page * { box-sizing: border-box; }
        .help-shell { width: 100%; max-width: none; padding: 0 20px; margin: 0; }
        .help-header { padding: 36px 0 28px; border-bottom: 1px solid var(--help-border); background: linear-gradient(180deg, rgba(49, 93, 130, 0.04), rgba(49, 93, 130, 0.01)); color: var(--help-text); box-shadow: 0 1px 0 rgba(15,31,46,0.02); }
        .help-header h1 { margin: 0; color: var(--help-text); font-size: 2rem; line-height: 1.2; overflow-wrap: anywhere; }
        .help-system { margin: 8px 0 0; color: var(--help-muted); font-size: 1.2rem; }
        .help-header h2 { margin: 22px 0 0; color: var(--help-primary); font-size: 1.65rem; }
        .help-body { padding: 28px 0 48px; }
        .help-intro { margin: 0 0 24px; color: var(--help-text-soft); line-height: 1.65; }
        .help-section { padding: 24px 0; border-top: 1px solid var(--help-outline); }
        .help-section h3 { margin: 0 0 12px; font-size: 1.2rem; }
        .help-section p { color: var(--help-text-soft); line-height: 1.65; }
        .help-action-links { display: flex; flex-wrap: wrap; gap: 10px 20px; }
        .help-action-links a, .help-inline-link { color: var(--help-brand); font-weight: 700; text-underline-offset: 3px; overflow-wrap: anywhere; }
        .help-topic h4 { margin: 0 0 8px; font-size: 1.05rem; }
        .help-topic ul { margin: 0; padding-left: 20px; color: var(--help-text-soft); line-height: 1.8; }
        .help-role-list { display: grid; gap: 12px; }
        .help-role-list p { margin: 0; }
        .help-search { display: flex; gap: 10px; min-width: 0; }
        .help-search input { flex: 1 1 auto; min-width: 0; height: 46px; padding: 0 13px; border: 1px solid var(--help-outline); border-radius: 6px; background: var(--help-surface); color: var(--help-text-main); font: inherit; }
        .help-search input:focus { border-color: var(--help-brand); outline: 3px solid rgba(49,93,130,0.12); }
        .help-search button { display: inline-flex; flex: 0 0 auto; align-items: center; justify-content: center; gap: 8px; min-height: 46px; padding: 0 16px; border: 1px solid var(--help-brand); border-radius: 6px; background: var(--help-brand); color: #fff; font: inherit; font-weight: 700; cursor: pointer; box-shadow: 0 6px 18px rgba(49,93,130,0.12); }
        .help-search button:hover { filter: brightness(0.96); }
        .help-search button:focus-visible { outline: 3px solid var(--help-highlight); outline-offset: 2px; }
        .help-faq-list { display: grid; gap: 10px; margin-top: 24px; }
        .help-faq-card { min-width: 0; overflow: hidden; border: 1px solid var(--help-outline); border-radius: 12px; background: var(--help-surface); box-shadow: 0 8px 20px rgba(15,31,46,0.04); }
        .help-faq-question { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 18px; border: 0; background: transparent; color: var(--help-text-main); text-align: left; font: inherit; font-weight: 700; cursor: pointer; }
        .help-faq-question:hover { background: rgba(49,93,130,0.04); }
        .help-faq-question:focus-visible { position: relative; z-index: 1; outline: 3px solid var(--help-highlight); outline-offset: -3px; }
        .help-faq-question span:first-child { min-width: 0; overflow-wrap: anywhere; }
        .help-faq-toggle { flex: 0 0 28px; display: grid; place-items: center; width: 28px; height: 28px; border-radius: 50%; background: rgba(49,93,130,0.08); color: var(--help-brand); font-size: 1.35rem; line-height: 1; }
        .help-faq-answer { display: none; }
        .help-faq-answer.is-open { display: block; }
        .help-faq-answer-inner { min-height: 0; overflow: hidden; }
        .help-faq-answer p { margin: 0; padding: 0 18px 18px; color: var(--help-text-soft); line-height: 1.65; overflow-wrap: anywhere; }
        .help-empty { margin: 24px 0 0; color: var(--help-text-soft); }
        @media (max-width: 640px) { .help-shell { width: calc(100% - 24px); } .help-header { padding: 28px 0 24px; } .help-header h1 { font-size: 1.75rem; } .help-header h2 { font-size: 1.45rem; } .help-search { align-items: stretch; flex-direction: column; } .help-search button { width: 100%; } }
      `}</style>

      <header className="help-header">
        <div className="help-shell">
          <h1>{text('Mekdela Amba University', 'መቅደላ አምባ ዩኒቨርሲቲ')}</h1>
          <p className="help-system">{text('University Asset Management System', 'የዩኒቨርሲቲ ንብረት አስተዳደር ስርዓት')}</p>
          <h2>{text('Help & Support', 'እገዛና ድጋፍ')}</h2>
        </div>
      </header>

      <div className="help-shell help-body">
        <form className="help-search" role="search" onSubmit={handleSearch}>
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpenFaqId(null);
            }}
            placeholder={text('Search questions', 'ጥያቄዎችን ይፈልጉ')}
            aria-label={text('Search questions', 'ጥያቄዎችን ይፈልጉ')}
          />
          <button type="submit"><Search size={18} aria-hidden="true" />{text('Search', 'ፈልግ')}</button>
        </form>

        <p className="help-intro">{text('Practical guidance for signing in and using the asset workflows available to your role.', 'ለመግባትና ለሚናዎ የተፈቀዱ የንብረት ሂደቶችን ለመጠቀም ተግባራዊ መመሪያ።')}</p>

        <section className="help-section" aria-labelledby="help-quick-actions">
          <h3 id="help-quick-actions">{text('Quick Actions', 'ፈጣን እርምጃዎች')}</h3>
          <div className="help-action-links">
            <Link to="/login">{text('Login', 'ግባ')}</Link>
            <Link to="/forgot-password">{text('Forgot Password', 'የይለፍ ቃል ረሳሁ')}</Link>
            <Link to="/contact">{text('Contact Support', 'ድጋፍን ያግኙ')}</Link>
          </div>
        </section>

        <section className="help-section" aria-labelledby="help-topics">
          <h3 id="help-topics">{text('Help Topics', 'የእገዛ ርዕሶች')}</h3>
          <article className="help-topic">
            <h4>{text('Asset Workflows', 'የንብረት ሂደቶች')}</h4>
            <ul>
              <li>{text('Asset assignment', 'የንብረት ምደባ')}</li>
              <li>{text('Asset transfer', 'የንብረት ዝውውር')}</li>
              <li>{text('Asset verification', 'የንብረት ማረጋገጫ')}</li>
              <li>{text('Maintenance requests', 'የጥገና ጥያቄዎች')}</li>
              <li>{text('Asset returns', 'የንብረት መመለሻ')}</li>
              <li>{text('Asset disposal', 'የንብረት ማስወገድ')}</li>
            </ul>
          </article>
        </section>

        <section className="help-section" aria-labelledby="help-demo-accounts">
          <h3 id="help-demo-accounts">{text('Development Demo Accounts', 'የልማት ሙከራ መለያዎች')}</h3>
          <p>{text(
            'For local development only, seeded demo accounts use the shared password configured by the system administrator. Never use demo accounts or shared passwords in production.',
            'ለአካባቢያዊ ልማት ብቻ፣ የተዘሩ የሙከራ መለያዎች በስርዓት አስተዳዳሪው የተዋቀረውን የጋራ የይለፍ ቃል ይጠቀማሉ። በምርት ስርዓት የሙከራ መለያዎችን ወይም የጋራ የይለፍ ቃሎችን በፍጹም አይጠቀሙ።'
          )}</p>
          <ul>
            {['admin', 'ict_officer', 'college_manager', 'department_head', 'finance', 'store_manager', 'maintenance', 'infrastructure'].map((username) => (
              <li key={username}><code>{username}</code></li>
            ))}
          </ul>
          <p>{text(
            'If a local demo login fails, ask the administrator to confirm the configured demo password. In a local development environment, set SEED_DEMO_PASSWORD in the backend environment, then run npm run reset:demo-passwords from the backend directory. This resets every listed demo account.',
            'የአካባቢያዊ የሙከራ መግቢያ ካልሰራ፣ አስተዳዳሪው የተዋቀረውን የሙከራ የይለፍ ቃል እንዲያረጋግጥ ይጠይቁ። በአካባቢያዊ የልማት አካባቢ፣ SEED_DEMO_PASSWORD ን በbackend አካባቢ ያዋቅሩና npm run reset:demo-passwords ን ከbackend ማውጫ ያስኪዱ። ይህ ሁሉንም የተዘረዘሩ የሙከራ መለያዎች ይቀይራል።'
          )}</p>
        </section>

        <section className="help-section" aria-labelledby="help-password-reset">
          <h3 id="help-password-reset">{text('Password Reset', 'የይለፍ ቃል ዳግም ማስጀመር')}</h3>
          <div className="help-action-links">
            <Link to="/forgot-password">{text('Open password recovery', 'የይለፍ ቃል ማግኛን ይክፈቱ')}</Link>
          </div>
        </section>

        <section className="help-section" aria-labelledby="help-faq-heading">
          <h3 id="help-faq-heading">{text('Frequently Asked Questions', 'ተደጋጋሚ ጥያቄዎች')}</h3>
          {filteredQuestions.length > 0 ? (
            <section className="help-faq-list" aria-label={text('Frequently Asked Questions', 'ተደጋጋሚ ጥያቄዎች')}>
              {filteredQuestions.map(([question, answer], index) => {
                const id = `help-faq-answer-${index}`;
                const isOpen = openFaqId === id;
                return (
                  <article key={question} className="help-faq-card">
                    <button
                      type="button"
                      className="help-faq-question"
                      aria-expanded={isOpen}
                      aria-controls={id}
                      onClick={() => setOpenFaqId(isOpen ? null : id)}
                    >
                      <span>{question}</span>
                      <span className="help-faq-toggle" aria-hidden="true">{isOpen ? '−' : '+'}</span>
                    </button>
                    <div id={id} className={`help-faq-answer${isOpen ? ' is-open' : ''}`} aria-hidden={!isOpen}>
                      <div className="help-faq-answer-inner"><p>{answer}</p></div>
                    </div>
                  </article>
                );
              })}
            </section>
          ) : (
            <p className="help-empty" role="status">{text('No matching results found.', 'ተዛማጅ ውጤት አልተገኘም።')}</p>
          )}
        </section>

        <section className="help-section" aria-labelledby="help-roles">
          <h3 id="help-roles">{text('Roles and Access', 'ሚናዎችና ፈቃዶች')}</h3>
          <div className="help-role-list">
            <p>{text('Your dashboard and available actions depend on your assigned role.', 'ዳሽቦርድዎና የሚገኙ እርምጃዎች በተመደበው ሚናዎ ይወሰናሉ።')}</p>
            <p>{text('System administration and broad asset-management workflows according to assigned permissions.', 'በተመደቡ ፈቃዶች መሠረት የስርዓት አስተዳደርና ሰፊ የንብረት አስተዳደር ሂደቶች።')}</p>
          </div>
        </section>

        <section className="help-section" aria-labelledby="help-more-support">
          <h3 id="help-more-support">{text('Need More Help?', 'ተጨማሪ እገዛ ያስፈልጋል?')}</h3>
          <div className="help-action-links">
            <Link to="/contact">{text('View Contact Information', 'የግንኙነት መረጃን ይመልከቱ')}</Link>
            <Link to="/">{text('Back to Home', 'ወደ መነሻ ገጽ')}</Link>
          </div>
        </section>
      </div>
    </main>
  );
};

export default Help;