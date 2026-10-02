module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      webpackConfig.module.rules = webpackConfig.module.rules.map((rule) => {
        if (!rule || typeof rule !== 'object') {
          return rule;
        }

        if (rule.enforce === 'pre' && rule.loader === require.resolve('source-map-loader')) {
          return {
            ...rule,
            exclude: /@babel(?:\/|\\{1,2})runtime|node_modules[/\\]html5-qrcode/,
          };
        }

        return rule;
      });

      return webpackConfig;
    },
  },
};
