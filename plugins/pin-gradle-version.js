const { withProjectBuildGradle } = require('@expo/config-plugins');

module.exports = function withPinnedGradle(config) {
  return withProjectBuildGradle(config, (config) => {
    config.modResults.contents = config.modResults.contents.replace(
      /distributionUrl=.*\n/,
      'distributionUrl=https\\://services.gradle.org/distributions/gradle-7.6.3-bin.zip\n'
    );
    return config;
  });
};
