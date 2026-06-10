const { defineConfig } = require('eslint/config');
const lwcConfig = require('@salesforce/eslint-config-lwc/recommended');

module.exports = defineConfig([
    {
        files: ['**/lwc/**/*.js'],
        extends: [lwcConfig]
    }
]);
