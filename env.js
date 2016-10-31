"use strict";

module.exports = function(config) {
    Object.keys(config).forEach((key, index) => {
        process.env[key] = config[key];
    });
}