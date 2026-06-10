const { defineConfig } = require('eslint/config');
const lwcConfig = require('@salesforce/eslint-config-lwc/recommended');
const jestPlugin = require('eslint-plugin-jest');
const globals = require('globals');

module.exports = defineConfig([
    {
        files: ['**/lwc/**/*.js'],
        extends: [lwcConfig]
    },

    // Jest test files: node/jest globals, async helpers are fine here
    {
        files: ['**/lwc/**/*.test.js'],
        extends: [lwcConfig],
        rules: {
            '@lwc/lwc/no-unexpected-wire-adapter-usages': 'off',
            '@lwc/lwc/no-async-operation': 'off'
        },
        languageOptions: {
            globals: {
                ...globals.node,
                ...jestPlugin.environments.globals.globals
            }
        }
    }
]);
