import React from 'react';
import { useTranslation } from '../../contexts/UiContext';

const Register = () => {
  const { t } = useTranslation();

  return (
    <div className="Register-container">
      <h1>{t('auth.registerPage.title')}</h1>
      <p>{t('auth.registerPage.placeholder')}</p>
    </div>
  );
};

export default Register;
