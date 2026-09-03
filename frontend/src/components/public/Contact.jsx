import React, { useState } from 'react';
import { useLanguage, useTheme } from '../../contexts/UiContext';
import { Mail, Phone, MapPin, Clock, Send } from 'lucide-react';
import { toast } from 'react-toastify';

const Contact = () => {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '' });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const t = language === 'en' ? {
    pageTitle: 'Contact Us',
    pageSubtitle: 'Have questions or need assistance? We\'re here to help.',
    contactInfo: 'Contact Information',
    form: 'Send Us a Message',
    email: 'Email',
    phone: 'Phone',
    address: 'Address',
    workingHours: 'Working Hours',
    emailValue: 'support@suams.edu',
    phoneValue: '+251-111-222-333',
    addressValue: 'Addis Ababa, Ethiopia',
    hoursValue: 'Monday - Friday, 8:00 AM - 5:00 PM',
    name: 'Full Name',
    subject: 'Subject',
    message: 'Message',
    send: 'Send Message',
    sending: 'Sending...',
    nameRequired: 'Please enter your name',
    emailRequired: 'Please enter a valid email',
    subjectRequired: 'Please enter a subject',
    messageRequired: 'Please enter a message',
    success: 'Message sent successfully! We\'ll get back to you soon.',
    successTitle: 'Thank You!',
    successMsg: 'Your message has been sent successfully. We will respond within 24 hours.',
    backToHome: 'Back to Home'
  } : {
    pageTitle: 'አግኙን',
    pageSubtitle: 'ጥያቄዎች ወይም እርዳታ ያስፈልግዎት? እኛ እዚህ ነን እና ለመርዳት ዝግጁ ነን።',
    contactInfo: 'የግንኙነት መረጃ',
    form: 'መልዕክት ላክልን',
    email: 'ኢሜይል',
    phone: 'ስልክ',
    address: 'አድራሻ',
    workingHours: 'የሥራ ጊዜ',
    emailValue: 'support@suams.edu',
    phoneValue: '+251-111-222-333',
    addressValue: 'አዲስ አበባ፣ ኢትዮጵያ',
    hoursValue: 'ሰኞ - አርብ, 8:00 ጠዋት - 5:00 ከሰዓት',
    name: 'ሙሉ ስም',
    subject: 'ርዕስ',
    message: 'መልዕክት',
    send: 'መልዕክት ላክ',
    sending: 'ይላካል...',
    nameRequired: 'እባክዎ ስምዎን ያስገቡ',
    emailRequired: 'እባክዎ ትክክለኛ ኢሜይል ያስገቡ',
    subjectRequired: 'እባክዎ ርዕስ ያስገቡ',
    messageRequired: 'እባክዎ መልዕክት ያስገቡ',
    success: 'መልዕክት በተሳካ ሁኔታ ተልካ! በቅርቡ ለእርስዎ መልስ እንሰጣለን።',
    successTitle: 'ምስጋና!',
    successMsg: 'መልዕክትዎ በተሳካ ሁኔታ ተልካል። በ 24 ሰዓት ውስጥ መልስ እንሰጣለን።',
    backToHome: 'ወደ ወጣታው'
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error(t.nameRequired);
      return;
    }
    if (!formData.email.trim() || !formData.email.includes('@')) {
      toast.error(t.emailRequired);
      return;
    }
    if (!formData.subject.trim()) {
      toast.error(t.subjectRequired);
      return;
    }
    if (!formData.message.trim()) {
      toast.error(t.messageRequired);
      return;
    }

    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    setSubmitted(true);
    setLoading(false);
    toast.success(t.success);
    setFormData({ name: '', email: '', subject: '', message: '' });
    setTimeout(() => setSubmitted(false), 3000);
  };

  const contactItems = [
    { icon: Mail, label: t.email, value: t.emailValue, href: `mailto:${t.emailValue}` },
    { icon: Phone, label: t.phone, value: t.phoneValue, href: `tel:${t.phoneValue}` },
    { icon: MapPin, label: t.address, value: t.addressValue, href: '#' },
    { icon: Clock, label: t.workingHours, value: t.hoursValue, href: '#' }
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

        {/* Contact Section */}
        <section style={{
          maxWidth: '1200px',
          margin: '60px auto',
          padding: '0 20px'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '32px'
          }}>
            {/* Contact Information */}
            <div>
              <h2 style={{
                fontSize: '1.8rem',
                fontWeight: 800,
                marginBottom: '32px',
                color: isDark ? '#f1f5f9' : '#0f172a'
              }}>
                {t.contactInfo}
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {contactItems.map((item, idx) => {
                  const IconComponent = item.icon;
                  return (
                    <a
                      key={idx}
                      href={item.href}
                      style={{
                        display: 'flex',
                        gap: '16px',
                        textDecoration: 'none',
                        padding: '16px',
                        borderRadius: '12px',
                        background: isDark ? '#1e293b' : '#f8fafc',
                        border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                        transition: 'all 0.3s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateX(8px)';
                        e.currentTarget.style.background = isDark ? '#334155' : '#f0f4ff';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateX(0)';
                        e.currentTarget.style.background = isDark ? '#1e293b' : '#f8fafc';
                      }}
                    >
                      <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '12px',
                        background: '#3b82f615',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <IconComponent size={24} color='#2563eb' />
                      </div>
                      <div>
                        <div style={{
                          fontSize: '0.9rem',
                          fontWeight: 600,
                          color: isDark ? '#cbd5e1' : '#475569',
                          marginBottom: '4px'
                        }}>
                          {item.label}
                        </div>
                        <div style={{
                          fontSize: '1rem',
                          fontWeight: 600,
                          color: isDark ? '#f1f5f9' : '#0f172a'
                        }}>
                          {item.value}
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>
            </div>

            {/* Contact Form */}
            <div>
              <h2 style={{
                fontSize: '1.8rem',
                fontWeight: 800,
                marginBottom: '24px',
                color: isDark ? '#f1f5f9' : '#0f172a'
              }}>
                {t.form}
              </h2>

              {submitted ? (
                <div style={{
                  background: isDark ? '#1e293b' : '#f0fdf4',
                  border: `1px solid ${isDark ? '#334155' : '#86efac'}`,
                  borderRadius: '12px',
                  padding: '32px 24px',
                  textAlign: 'center',
                  animation: 'slideUp 0.4s ease'
                }}>
                  <div style={{
                    fontSize: '3rem',
                    marginBottom: '16px'
                  }}>
                    ✅
                  </div>
                  <h3 style={{
                    fontSize: '1.5rem',
                    fontWeight: 700,
                    marginBottom: '8px',
                    color: isDark ? '#f1f5f9' : '#0f172a'
                  }}>
                    {t.successTitle}
                  </h3>
                  <p style={{
                    color: isDark ? '#cbd5e1' : '#475569',
                    lineHeight: 1.6
                  }}>
                    {t.successMsg}
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px'
                }}>
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      marginBottom: '8px',
                      color: isDark ? '#f1f5f9' : '#0f172a'
                    }}>
                      {t.name}
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        borderRadius: '8px',
                        border: `2px solid ${isDark ? '#334155' : '#d0d8e8'}`,
                        background: isDark ? '#0f172a' : '#f7fafc',
                        color: isDark ? '#f1f5f9' : '#0f172a',
                        fontSize: '1rem',
                        transition: 'all 0.3s ease',
                        boxSizing: 'border-box'
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#2563eb';
                        e.target.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = isDark ? '#334155' : '#d0d8e8';
                        e.target.style.boxShadow = 'none';
                      }}
                    />
                  </div>

                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      marginBottom: '8px',
                      color: isDark ? '#f1f5f9' : '#0f172a'
                    }}>
                      {t.email}
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        borderRadius: '8px',
                        border: `2px solid ${isDark ? '#334155' : '#d0d8e8'}`,
                        background: isDark ? '#0f172a' : '#f7fafc',
                        color: isDark ? '#f1f5f9' : '#0f172a',
                        fontSize: '1rem',
                        transition: 'all 0.3s ease',
                        boxSizing: 'border-box'
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#2563eb';
                        e.target.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = isDark ? '#334155' : '#d0d8e8';
                        e.target.style.boxShadow = 'none';
                      }}
                    />
                  </div>

                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      marginBottom: '8px',
                      color: isDark ? '#f1f5f9' : '#0f172a'
                    }}>
                      {t.subject}
                    </label>
                    <input
                      type="text"
                      name="subject"
                      value={formData.subject}
                      onChange={handleChange}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        borderRadius: '8px',
                        border: `2px solid ${isDark ? '#334155' : '#d0d8e8'}`,
                        background: isDark ? '#0f172a' : '#f7fafc',
                        color: isDark ? '#f1f5f9' : '#0f172a',
                        fontSize: '1rem',
                        transition: 'all 0.3s ease',
                        boxSizing: 'border-box'
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#2563eb';
                        e.target.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = isDark ? '#334155' : '#d0d8e8';
                        e.target.style.boxShadow = 'none';
                      }}
                    />
                  </div>

                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      marginBottom: '8px',
                      color: isDark ? '#f1f5f9' : '#0f172a'
                    }}>
                      {t.message}
                    </label>
                    <textarea
                      name="message"
                      value={formData.message}
                      onChange={handleChange}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        borderRadius: '8px',
                        border: `2px solid ${isDark ? '#334155' : '#d0d8e8'}`,
                        background: isDark ? '#0f172a' : '#f7fafc',
                        color: isDark ? '#f1f5f9' : '#0f172a',
                        fontSize: '1rem',
                        minHeight: '120px',
                        resize: 'vertical',
                        transition: 'all 0.3s ease',
                        boxSizing: 'border-box',
                        fontFamily: 'inherit'
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#2563eb';
                        e.target.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = isDark ? '#334155' : '#d0d8e8';
                        e.target.style.boxShadow = 'none';
                      }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    style={{
                      padding: '14px',
                      background: 'linear-gradient(135deg, #2563eb, #1e40af)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: 700,
                      fontSize: '1rem',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      transition: 'all 0.3s ease',
                      opacity: loading ? 0.7 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                    onMouseEnter={(e) => {
                      if (!loading) {
                        e.target.style.transform = 'translateY(-2px)';
                        e.target.style.boxShadow = '0 10px 20px rgba(37, 99, 235, 0.3)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!loading) {
                        e.target.style.transform = 'translateY(0)';
                        e.target.style.boxShadow = 'none';
                      }
                    }}
                  >
                    <Send size={18} />
                    {loading ? t.sending : t.send}
                  </button>
                </form>
              )}
            </div>
          </div>
        </section>
      </main>

      <style>{`
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

export default Contact;
