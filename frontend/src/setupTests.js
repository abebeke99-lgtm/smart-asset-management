// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

jest.mock('react-router-dom', () => {
  const React = require('react');
  const router = jest.requireActual('react-router-dom');
  const MemoryRouter = React.forwardRef(({ future, ...props }, ref) => React.createElement(
    router.MemoryRouter,
    {
      ...props,
      future: {
        ...future,
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      },
      ref,
    },
  ));

  return { ...router, MemoryRouter };
});
