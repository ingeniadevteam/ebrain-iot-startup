"use strict";

const joi = require('joi');

// the validation schema
const startupSchema = joi.object({
  init: joi.string().valid("systemd").default("systemd"),
  type: joi.string().valid("src", "binary").default("src"),
  enabled: joi.boolean().default(true),
  service_name: joi.string().default(process.env.npm_package_name),
  user: joi.string().default('pi'),
  group: joi.string().default('pi'),
}).unknown().required();


module.exports = async function (startupObject) {
  // validate the config object
  const validation = startupSchema.validate(startupObject || {});
  if (validation.error) {
    const errors = [];
    validation.error.details.forEach( detail => {
      errors.push(detail.message);
    });
    // process failed
    throw new Error(`startup validation error: ${errors.join(", ")}`);
  }

  return validation.value;
};
