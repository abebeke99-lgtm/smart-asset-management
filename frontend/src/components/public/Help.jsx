import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { useLanguage, useTheme } from '../../contexts/UiContext';
import './Help.css';

const Help = () => {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const [query, setQuery] = useState('');
  const [openFaqId, setOpenFaqId] = useState(null);
  const isEnglish = language === 'en';
  const text = (english, amharic) => (isEnglish ? english : amharic);

  const categories = [
    {
      id: 'asset-registration',
      title: text('Asset Registration and Management', 'የንብረት ምዝገባና አስተዳደር'),
      description: text('Register assets and find existing asset records.', 'ንብረቶችን ይመዝግቡና ያሉ የንብረት መዝገቦችን ያግኙ።'),
      keywords: 'register create add asset search find record qr digital id serial number',
    },
    {
      id: 'asset-assignment',
      title: text('Asset Assignment and Return', 'የንብረት ምደባና መመለስ'),
      description: text('Follow the assignment and return workflows available to your role.', 'ለሚናዎ የሚገኙትን የምደባና መመለሻ ሂደቶች ይከተሉ።'),
      keywords: 'assign user department staff checkout return hand back custody',
    },
    {
      id: 'asset-transfer',
      title: text('Asset Transfer and Verification', 'የንብረት ዝውውርና ማረጋገጫ'),
      description: text('Request transfers and record physical asset checks.', 'የዝውውር ጥያቄ ያቅርቡና የንብረት አካላዊ ምርመራን ይመዝግቡ።'),
      keywords: 'transfer move destination location physical check verify verification qr',
    },
    {
      id: 'maintenance',
      title: text('Maintenance Requests', 'የጥገና ጥያቄዎች'),
      description: text('Report an asset problem and follow its maintenance status.', 'የንብረት ችግርን ያሳውቁና የጥገና ሁኔታውን ይከታተሉ።'),
      keywords: 'repair problem fault service request issue condition',
    },
    {
      id: 'inventory',
      title: text('Inventory and Stock Management', 'የኢንቬንተሪና ክምችት አስተዳደር'),
      description: text('Review the inventory records and quantities available to your role.', 'ለሚናዎ የሚገኙ የኢንቬንተሪ መዝገቦችንና ብዛቶችን ይመልከቱ።'),
      keywords: 'stock quantity count available status supplies',
    },
    {
      id: 'asset-disposal',
      title: text('Asset Disposal', 'የንብረት ማስወገድ'),
      description: text('Disposal actions are available only to accounts with the required access.', 'የማስወገድ እርምጃዎች ተገቢው ፈቃድ ላላቸው መለያዎች ብቻ ይገኛሉ።'),
      keywords: 'retire write off disposal remove decommission',
    },
    {
      id: 'accounts-permissions',
      title: text('User Accounts and Permissions', 'የተጠቃሚ መለያዎችና ፈቃዶች'),
      description: text('Your access depends on your account, assigned role, and permissions.', 'የመለያዎ መዳረሻ በተመደበው ሚናና ፈቃድ ይወሰናል።'),
      keywords: 'department head access login sign in password account permission role denied',
    },
    {
      id: 'reports-dashboards',
      title: text('Reports and Dashboards', 'ሪፖርቶችና ዳሽቦርዶች'),
      description: text('Use the reports and dashboard views provided for your account and role.', 'ለመለያዎና ሚናዎ የቀረቡትን የሪፖርትና ዳሽቦርድ እይታዎች ይጠቀሙ።'),
      keywords: 'report dashboard analytics charts trends summary',
    }
  ];

  const faqs = [
    {
      id: 'register-asset',
      categoryId: 'asset-registration',
      question: text('How do I register a new asset?', 'አዲስ ንብረት እንዴት እመዘግባለሁ?'),
      answer: [
        text('Sign in and open the asset area provided in your role’s navigation.', 'ይግቡና በሚናዎ ማውጫ የቀረበውን የንብረት ክፍል ይክፈቱ።'),
        text('Choose the available create or register action, complete the required asset fields, and save the record. Some roles generate an asset ID automatically.', 'የሚገኘውን የመፍጠር ወይም የመመዝገብ እርምጃ ይምረጡ፣ የሚያስፈልጉትን የንብረት መረጃዎች ይሙሉና መዝገቡን ያስቀምጡ። በአንዳንድ ሚናዎች የንብረት መለያ ቁጥር በራስ-ሰር ይፈጠራል።'),
        text('If you cannot see a registration action, your account may not have permission to register assets; contact your administrator.', 'የመመዝገቢያ እርምጃው ካልታየዎት መለያዎ ንብረት ለመመዝገብ ፈቃድ ላይኖረው ይችላል፤ አስተዳዳሪዎን ያነጋግሩ።')
      ],
      keywords: 'create asset add new register asset id name category location'
    },
    {
      id: 'search-assets',
      categoryId: 'asset-registration',
      question: text('How do I search for an existing asset?', 'ያለ ንብረትን እንዴት እፈልጋለሁ?'),
      answer: [
        text('Open the assets or inventory view available in your role’s navigation.', 'በሚናዎ ማውጫ የሚገኘውን የንብረት ወይም የኢንቬንተሪ እይታ ይክፈቱ።'),
        text('Enter an asset identifier or other available search term, or narrow the list with the filters shown on that page. Department Heads can search and filter the assets authorized for their department.', 'የንብረት መለያ ወይም የሚገኝ ሌላ የፍለጋ ቃል ያስገቡ፣ ወይም በገጹ የሚታዩትን ማጣሪያዎች ይጠቀሙ። የክፍል ኃላፊዎች ለክፍላቸው የተፈቀዱ ንብረቶችን መፈለግና ማጣራት ይችላሉ።'),
        text('Select a matching record to view the asset details your role is permitted to see.', 'ሚናዎ ለማየት የፈቀደልዎትን ዝርዝር ለማየት የሚዛመደውን መዝገብ ይምረጡ።')
      ],
      keywords: 'find look up asset search filter asset id digital id serial qr'
    },
    {
      id: 'assign-asset',
      categoryId: 'asset-assignment',
      question: text('How do I assign an asset to a user or department?', 'ንብረትን ለተጠቃሚ ወይም ለክፍል እንዴት እመድባለሁ?'),
      answer: [
        text('Open the assignments workflow available in your role’s navigation and choose its create or assign action.', 'በሚናዎ ማውጫ የሚገኘውን የምደባ ሂደት ይክፈቱና የመፍጠር ወይም የመመደብ እርምጃውን ይምረጡ።'),
        text('Select the asset and the recipient or department requested by the form, complete its required assignment details, and submit.', 'ንብረቱንና በቅጹ የተጠየቀውን ተቀባይ ወይም ክፍል ይምረጡ፣ የሚያስፈልጉትን የምደባ ዝርዝሮች ይሙሉና ያስገቡ።'),
        text('If the assignment action or recipient is unavailable, ask your administrator or the responsible asset office to check your access.', 'የምደባ እርምጃው ወይም ተቀባዩ ካልታየ፣ አስተዳዳሪዎን ወይም ኃላፊውን የንብረት ቢሮ ፈቃድዎን እንዲያረጋግጡ ይጠይቁ።')
      ],
      keywords: 'assign assignment user department recipient allocate'
    },
    {
      id: 'transfer-asset',
      categoryId: 'asset-transfer',
      question: text('How do I request an asset transfer?', 'የንብረት ዝውውር እንዴት እጠይቃለሁ?'),
      answer: [
        text('Open Transfers in your role’s navigation and start a transfer request if that action is available.', 'በሚናዎ ማውጫ ውስጥ ዝውውሮችን ይክፈቱና እርምጃው ከታየ የዝውውር ጥያቄ ይጀምሩ።'),
        text('Select the asset, enter the destination and reason requested by the form, then submit the request.', 'ንብረቱን ይምረጡ፣ በቅጹ የተጠየቀውን መድረሻና ምክንያት ያስገቡና ጥያቄውን ያስገቡ።'),
        text('Follow the request in Transfers. Approval, dispatch, or receipt actions depend on your role and the current transfer status.', 'ጥያቄውን በዝውውሮች ውስጥ ይከታተሉ። የማጽደቅ፣ የመላክ ወይም የመቀበል እርምጃዎች በሚናዎና በዝውውሩ ሁኔታ ይወሰናሉ።')
      ],
      keywords: 'transfer move request destination reason approve dispatch receive location'
    },
    {
      id: 'verify-asset',
      categoryId: 'asset-transfer',
      question: text('How do I verify an asset?', 'ንብረትን እንዴት አረጋግጣለሁ?'),
      answer: [
        text('Open the verification workflow available in your role’s navigation and select the physical-check form.', 'በሚናዎ ማውጫ የሚገኘውን የማረጋገጫ ሂደት ይክፈቱና የአካላዊ ምርመራ ቅጹን ይምረጡ።'),
        text('Identify the asset using the fields or QR code supported by that form, check it in person, and record the requested verification details.', 'ቅጹ በሚደግፋቸው መስኮች ወይም QR ኮድ ንብረቱን ይለዩ፣ በአካል ይመርምሩትና የተጠየቀውን የማረጋገጫ ዝርዝር ይመዝግቡ።'),
        text('Save the check and review verification history if that view is available to your role.', 'ምርመራውን ያስቀምጡና ለሚናዎ የሚገኝ ከሆነ የማረጋገጫ ታሪኩን ይመልከቱ።')
      ],
      keywords: 'verify verification physical check qr code asset inspection history'
    },
    {
      id: 'maintenance-request',
      categoryId: 'maintenance',
      question: text('How do I report a maintenance problem?', 'የጥገና ችግርን እንዴት አሳውቃለሁ?'),
      answer: [
        text('Open Maintenance or Maintenance Requests from your role’s navigation and choose the available request action.', 'በሚናዎ ማውጫ ውስጥ ጥገናዎችን ወይም የጥገና ጥያቄዎችን ይክፈቱና የሚገኘውን የጥያቄ እርምጃ ይምረጡ።'),
        text('Identify the affected asset and provide the title and description requested by the form. Add any other required details, then submit.', 'የተጎዳውን ንብረት ይለዩና በቅጹ የተጠየቀውን ርዕስና መግለጫ ያስገቡ። ሌሎች የሚያስፈልጉ ዝርዝሮችን ያክሉና ያስገቡ።'),
        text('Return to the maintenance view available to your role to follow the request status.', 'የጥያቄውን ሁኔታ ለመከታተል በሚናዎ የሚገኘውን የጥገና እይታ እንደገና ይክፈቱ።')
      ],
      keywords: 'maintenance repair problem issue fault service title description status'
    },
    {
      id: 'return-asset',
      categoryId: 'asset-assignment',
      question: text('How do I return an assigned asset?', 'የተመደበ ንብረትን እንዴት እመልሳለሁ?'),
      answer: [
        text('Open Returns or the return workflow available in your role’s navigation and choose Record Return if it is shown.', 'በሚናዎ ማውጫ የሚገኙትን መመለሻዎች ወይም የመመለሻ ሂደት ይክፈቱና ከታየ መመለስን መዝግብ የሚለውን ይምረጡ።'),
        text('Select the assigned asset, complete the return details requested by the form, and save the return.', 'የተመደበውን ንብረት ይምረጡ፣ በቅጹ የተጠየቁትን የመመለሻ ዝርዝሮች ይሙሉና መመለሱን ያስቀምጡ።'),
        text('Check Return History or ask the responsible asset office if you need help confirming that the return was recorded.', 'መመለሱ መመዝገቡን ማረጋገጥ ከፈለጉ የመመለሻ ታሪክን ይመልከቱ ወይም ኃላፊውን የንብረት ቢሮ ያነጋግሩ።')
      ],
      keywords: 'return assigned asset hand back record return history'
    },
    {
      id: 'inventory-status',
      categoryId: 'inventory',
      question: text('How do I check inventory status?', 'የኢንቬንተሪ ሁኔታን እንዴት አያለሁ?'),
      answer: [
        text('Open Inventory or the inventory report available in your role’s navigation.', 'በሚናዎ ማውጫ የሚገኘውን ኢንቬንተሪ ወይም የኢንቬንተሪ ሪፖርት ይክፈቱ።'),
        text('Review the quantities and status shown for the records you are authorized to access. Use the available search or filters to narrow the list.', 'ለመዳረስ ፈቃድ ላላቸው መዝገቦች የሚታዩትን ብዛቶችና ሁኔታዎች ይመልከቱ። ዝርዝሩን ለማጣራት የሚገኙትን ፍለጋና ማጣሪያዎች ይጠቀሙ።'),
        text('If you need stock information outside your role’s view, contact the responsible store or asset office.', 'ከሚናዎ እይታ ውጭ ያለ የክምችት መረጃ ከፈለጉ ኃላፊውን የመጋዘን ወይም የንብረት ቢሮ ያነጋግሩ።')
      ],
      keywords: 'inventory stock quantities status available supplies'
    },
    {
      id: 'department-head-access',
      categoryId: 'accounts-permissions',
      question: text('What can a Department Head access?', 'የክፍል ኃላፊ ምን ማየት ይችላል?'),
      answer: [
        text('A Department Head can view assets authorized for their department in Department Assets, including the available asset search and filters.', 'የክፍል ኃላፊ በክፍል ንብረቶች ውስጥ ለክፍሉ የተፈቀዱ ንብረቶችን፣ የንብረት ፍለጋና ማጣሪያዎችን ማየት ይችላል።'),
        text('The asset details include fields such as asset ID, name, category, status, condition, location, assigned user, and maintenance status when those details are available.', 'የንብረት ዝርዝሮቹ ሲኖሩ እንደ የንብረት መለያ፣ ስም፣ ምድብ፣ ሁኔታ፣ ጥራት፣ ቦታ፣ የተመደበለት ተጠቃሚ እና የጥገና ሁኔታ ያሉ መረጃዎችን ያካትታሉ።'),
        text('Other actions and records depend on permissions assigned to the account. Ask your administrator if you need access that is not shown.', 'ሌሎች እርምጃዎችና መዝገቦች በመለያው በተመደቡ ፈቃዶች ይወሰናሉ። የሚፈልጉት መዳረሻ ካልታየ አስተዳዳሪዎን ያነጋግሩ።')
      ],
      keywords: 'department head role access department assets search filter permissions'
    },
    {
      id: 'dispose-asset',
      categoryId: 'asset-disposal',
      question: text('How do I request asset disposal?', 'የንብረት ማስወገድ እንዴት እጠይቃለሁ?'),
      answer: [
        text('If disposal is part of your role, open the disposal workflow from your role’s navigation and choose the available request action.', 'ማስወገድ የሚናዎ አካል ከሆነ በሚናዎ ማውጫ ውስጥ የማስወገድ ሂደትን ይክፈቱና የሚገኘውን የጥያቄ እርምጃ ይምረጡ።'),
        text('Select the asset, provide the reason and other required information shown on the form, and submit it for the review required by your workflow.', 'ንብረቱን ይምረጡ፣ ምክንያቱንና በቅጹ የሚታዩትን ሌሎች የሚያስፈልጉ መረጃዎች ያስገቡና በሂደቱ ለሚያስፈልገው ግምገማ ያቅርቡ።'),
        text('If you cannot see disposal, do not assume your account can request it; contact your administrator or the responsible asset office.', 'የማስወገድ እርምጃው ካልታየ መለያዎ ሊጠይቀው እንደሚችል አያስቡ፤ አስተዳዳሪዎን ወይም ኃላፊውን የንብረት ቢሮ ያነጋግሩ።')
      ],
      keywords: 'disposal retire retirement request asset reason review'
    },
    {
      id: 'cannot-login',
      categoryId: 'accounts-permissions',
      question: text('What should I do if I cannot log in?', 'መግባት ካልቻልኩ ምን ላድርግ?'),
      answer: [
        text('Check that you are using the correct account details and that Caps Lock is off, then try again.', 'ትክክለኛውን የመለያ መረጃ መጠቀምዎንና Caps Lock መጥፋቱን ያረጋግጡና እንደገና ይሞክሩ።'),
        text('If you have forgotten your password, use Forgot Password on the sign-in page and follow the recovery steps.', 'የይለፍ ቃልዎን ከረሱ በመግቢያ ገጹ ላይ የይለፍ ቃል ረሳሁን ይጠቀሙና የመመለሻ እርምጃዎችን ይከተሉ።'),
        text('If you still cannot sign in, contact support or your administrator to check your account. Never share your password.', 'አሁንም መግባት ካልቻሉ መለያዎን እንዲያረጋግጡ ድጋፍን ወይም አስተዳዳሪዎን ያነጋግሩ። የይለፍ ቃልዎን በፍጹም አያጋሩ።')
      ],
      keywords: 'login sign in password forgot account access credentials'
    }
  ];

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const matchesQuery = (content) => normalizedQuery
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => content.toLocaleLowerCase().includes(term));
  const visibleCategories = categories
    .map((category) => {
      const categoryMatches = normalizedQuery
        && matchesQuery(`${category.title} ${category.description} ${category.keywords}`);
      const categoryFaqs = faqs.filter((faq) => faq.categoryId === category.id);
      const matchingFaqs = categoryFaqs.filter((faq) =>
        categoryMatches
        || matchesQuery(`${faq.question} ${faq.answer.join(' ')} ${faq.keywords}`)
      );

      return { ...category, faqs: normalizedQuery ? matchingFaqs : categoryFaqs };
    })
    .filter((category) => !normalizedQuery || category.faqs.length > 0 || (
      matchesQuery(`${category.title} ${category.description} ${category.keywords}`)
    ));

  const resultCount = visibleCategories.reduce((total, category) => total + category.faqs.length, 0);

  return (
    <main className={`help-page${theme === 'dark' ? ' help-page-dark' : ''}`}>
      <header className="help-header">
        <div className="help-shell">
          <p className="help-system">{text('Mekdela Amba University · University Asset Management System', 'መቅደላ አምባ ዩኒቨርሲቲ · የዩኒቨርሲቲ ንብረት አስተዳደር ስርዓት')}</p>
          <h1>{text('Help & Support', 'እገዛና ድጋፍ')}</h1>
          <p className="help-intro">{text('Find guidance for managing university assets and using the tools available to your role.', 'የዩኒቨርሲቲ ንብረቶችን ለማስተዳደርና ለሚናዎ የሚገኙትን መሣሪያዎች ለመጠቀም መመሪያ ያግኙ።')}</p>
        </div>
      </header>

      <div className="help-shell help-body">
        <form className="help-search" role="search" onSubmit={(event) => event.preventDefault()}>
          <Search className="help-search-icon" size={20} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpenFaqId(null);
            }}
            placeholder={text(
              'Search by topic, question, or keyword (e.g., transfer, inventory, assignment)',
              'በርዕስ፣ በጥያቄ ወይም በቁልፍ ቃል ይፈልጉ (ለምሳሌ፦ ዝውውር፣ ኢንቬንተሪ፣ ምደባ)'
            )}
            aria-label={text('Search help topics', 'የእገዛ ርዕሶችን ይፈልጉ')}
            aria-describedby="help-search-hint"
          />
          {query && (
            <button
              className="help-search-clear"
              type="button"
              onClick={() => {
                setQuery('');
                setOpenFaqId(null);
              }}
              aria-label={text('Clear search', 'ፍለጋውን አጽዳ')}
            >
              <X size={18} aria-hidden="true" />
            </button>
          )}
        </form>
        <p className="help-search-hint" id="help-search-hint">{text('Results update as you type. Search is not case-sensitive.', 'በሚተይቡበት ጊዜ ውጤቶች ይታያሉ። ፍለጋው በትልቅና በትንሽ ፊደል መካከል ልዩነት አያደርግም።')}</p>

        <nav className="help-action-links" aria-label={text('Quick links', 'ፈጣን አገናኞች')}>
          <Link to="/login">{text('Login', 'ግባ')}</Link>
          <Link to="/forgot-password">{text('Forgot Password', 'የይለፍ ቃል ረሳሁ')}</Link>
          <Link to="/contact">{text('Contact Support', 'ድጋፍን ያግኙ')}</Link>
        </nav>

        <section className="help-topics" aria-labelledby="help-topics-heading">
          <div className="help-topics-heading">
            <h2 id="help-topics-heading">{text('Help Topics', 'የእገዛ ርዕሶች')}</h2>
            <p className="help-result-count" role="status" aria-live="polite">
              {normalizedQuery
                ? text(
                  `${visibleCategories.length} matching ${visibleCategories.length === 1 ? 'topic' : 'topics'} · ${resultCount} ${resultCount === 1 ? 'question' : 'questions'}`,
                  `${visibleCategories.length} ተዛማጅ ርዕሶች · ${resultCount} ተዛማጅ ጥያቄዎች`
                )
                : text('Browse by topic or choose a question below.', 'በርዕስ ያስሱ ወይም ከታች ጥያቄ ይምረጡ።')}
            </p>
          </div>

          {visibleCategories.length > 0 ? (
            <div className="help-category-list">
              {visibleCategories.map((category) => (
                <section className="help-category" key={category.id} aria-labelledby={`help-category-${category.id}`}>
                  <div className="help-category-heading">
                    <h3 id={`help-category-${category.id}`}>{category.title}</h3>
                    <p>{category.description}</p>
                  </div>
                  {category.faqs.length > 0 && (
                    <div className="help-faq-list">
                      {category.faqs.map((faq) => {
                        const answerId = `help-faq-answer-${faq.id}`;
                        const isOpen = openFaqId === faq.id;

                        return (
                          <article className="help-faq-card" key={faq.id}>
                            <h4 className="help-faq-heading">
                              <button
                                type="button"
                                className="help-faq-question"
                                aria-expanded={isOpen}
                                aria-controls={answerId}
                                onClick={() => setOpenFaqId(isOpen ? null : faq.id)}
                              >
                                <span>{faq.question}</span>
                                <span className="help-faq-toggle" aria-hidden="true">{isOpen ? '−' : '+'}</span>
                              </button>
                            </h4>
                            <div id={answerId} className="help-faq-answer" hidden={!isOpen}>
                              <ol>
                                {faq.answer.map((step, index) => <li key={index}>{step}</li>)}
                              </ol>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </section>
              ))}
            </div>
          ) : (
            <div className="help-empty" role="status">
              <p>{text('No results found. Try another keyword or clear your search.', 'ምንም ውጤት አልተገኘም። ሌላ ቁልፍ ቃል ይሞክሩ ወይም ፍለጋውን ያጽዱ።')}</p>
              <button
                className="help-empty-clear"
                type="button"
                onClick={() => {
                  setQuery('');
                  setOpenFaqId(null);
                }}
              >
                {text('Clear search', 'ፍለጋውን አጽዳ')}
              </button>
            </div>
          )}
        </section>

        <footer className="help-footer">
          <h2>{text('Need more help?', 'ተጨማሪ እገዛ ያስፈልጋል?')}</h2>
          <p>{text('For account access or workflow questions, contact the support team or your system administrator.', 'ስለ መለያ መዳረሻ ወይም የሥራ ሂደቶች ጥያቄ ካለዎት የድጋፍ ቡድኑን ወይም የስርዓቱን አስተዳዳሪ ያነጋግሩ።')}</p>
          <div className="help-action-links">
            <Link to="/contact">{text('View Contact Information', 'የግንኙነት መረጃን ይመልከቱ')}</Link>
            <Link to="/">{text('Back to Home', 'ወደ መነሻ ገጽ')}</Link>
          </div>
        </footer>
      </div>
    </main>
  );
};

export default Help;
