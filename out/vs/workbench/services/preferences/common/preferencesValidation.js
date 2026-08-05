import * as nls from "../../../../nls.js";
import { Color } from "../../../../base/common/color.js";
import { isObject, isUndefinedOrNull, isString, isStringArray } from "../../../../base/common/types.js";
function canBeType(propTypes, ...types) {
  return types.some((t) => propTypes.includes(t));
}
function isNullOrEmpty(value) {
  return value === "" || isUndefinedOrNull(value);
}
function createValidator(prop) {
  const type = Array.isArray(prop.type) ? prop.type : [prop.type];
  const isNullable = canBeType(type, "null");
  const isNumeric = (canBeType(type, "number") || canBeType(type, "integer")) && (type.length === 1 || type.length === 2 && isNullable);
  const numericValidations = getNumericValidators(prop);
  const stringValidations = getStringValidators(prop);
  const arrayValidator = getArrayValidator(prop);
  const objectValidator = getObjectValidator(prop);
  return (value) => {
    if (isNullable && isNullOrEmpty(value)) {
      return "";
    }
    const errors = [];
    if (arrayValidator) {
      const err = arrayValidator(value);
      if (err) {
        errors.push(err);
      }
    }
    if (objectValidator) {
      const err = objectValidator(value);
      if (err) {
        errors.push(err);
      }
    }
    if (prop.type === "boolean" && value !== true && value !== false) {
      errors.push(nls.localize("validations.booleanIncorrectType", 'Incorrect type. Expected "boolean".'));
    }
    if (isNumeric) {
      if (isNullOrEmpty(value) || typeof value === "boolean" || Array.isArray(value) || isNaN(+value)) {
        errors.push(nls.localize("validations.expectedNumeric", "Value must be a number."));
      } else {
        errors.push(...numericValidations.filter((validator) => !validator.isValid(+value)).map((validator) => validator.message));
      }
    }
    if (prop.type === "string") {
      if (prop.enum && !isStringArray(prop.enum)) {
        errors.push(nls.localize("validations.stringIncorrectEnumOptions", "The enum options should be strings, but there is a non-string option. Please file an issue with the extension author."));
      } else if (!isString(value)) {
        errors.push(nls.localize("validations.stringIncorrectType", 'Incorrect type. Expected "string".'));
      } else {
        errors.push(...stringValidations.filter((validator) => !validator.isValid(value)).map((validator) => validator.message));
      }
    }
    if (errors.length) {
      return prop.errorMessage ? [prop.errorMessage, ...errors].join(" ") : errors.join(" ");
    }
    return "";
  };
}
function getInvalidTypeError(value, type) {
  if (typeof type === "undefined") {
    return;
  }
  const typeArr = Array.isArray(type) ? type : [type];
  if (!typeArr.some((_type) => valueValidatesAsType(value, _type))) {
    return nls.localize("invalidTypeError", "Setting has an invalid type, expected {0}. Fix in JSON.", JSON.stringify(type));
  }
  return;
}
function valueValidatesAsType(value, type) {
  const valueType = typeof value;
  if (type === "boolean") {
    return valueType === "boolean";
  } else if (type === "object") {
    return value && !Array.isArray(value) && valueType === "object";
  } else if (type === "null") {
    return value === null;
  } else if (type === "array") {
    return Array.isArray(value);
  } else if (type === "string") {
    return valueType === "string";
  } else if (type === "number" || type === "integer") {
    return valueType === "number";
  }
  return true;
}
function toRegExp(pattern) {
  try {
    return new RegExp(pattern, "u");
  } catch (e) {
    try {
      return new RegExp(pattern);
    } catch (e2) {
      console.error(nls.localize("regexParsingError", "Error parsing the following regex both with and without the u flag:"), pattern);
      return /.*/;
    }
  }
}
function getStringValidators(prop) {
  const uriRegex = /^(([^:/?#]+?):)?(\/\/([^/?#]*))?([^?#]*)(\?([^#]*))?(#(.*))?/;
  let patternRegex;
  if (typeof prop.pattern === "string") {
    patternRegex = toRegExp(prop.pattern);
  }
  return [
    {
      enabled: prop.maxLength !== void 0,
      isValid: (value) => value.length <= prop.maxLength,
      message: nls.localize("validations.maxLength", "Value must be {0} or fewer characters long.", prop.maxLength)
    },
    {
      enabled: prop.minLength !== void 0,
      isValid: (value) => value.length >= prop.minLength,
      message: nls.localize("validations.minLength", "Value must be {0} or more characters long.", prop.minLength)
    },
    {
      enabled: patternRegex !== void 0,
      isValid: (value) => patternRegex.test(value),
      message: prop.patternErrorMessage || nls.localize("validations.regex", "Value must match regex `{0}`.", prop.pattern)
    },
    {
      enabled: prop.format === "color-hex",
      isValid: (value) => Color.Format.CSS.parseHex(value),
      message: nls.localize("validations.colorFormat", "Invalid color format. Use #RGB, #RGBA, #RRGGBB or #RRGGBBAA.")
    },
    {
      enabled: prop.format === "uri" || prop.format === "uri-reference",
      isValid: (value) => !!value.length,
      message: nls.localize("validations.uriEmpty", "URI expected.")
    },
    {
      enabled: prop.format === "uri" || prop.format === "uri-reference",
      isValid: (value) => uriRegex.test(value),
      message: nls.localize("validations.uriMissing", "URI is expected.")
    },
    {
      enabled: prop.format === "uri",
      isValid: (value) => {
        const matches = value.match(uriRegex);
        return !!(matches && matches[2]);
      },
      message: nls.localize("validations.uriSchemeMissing", "URI with a scheme is expected.")
    },
    {
      enabled: prop.enum !== void 0,
      isValid: (value) => {
        return prop.enum.includes(value);
      },
      message: nls.localize(
        "validations.invalidStringEnumValue",
        "Value is not accepted. Valid values: {0}.",
        prop.enum ? prop.enum.map((key) => `"${key}"`).join(", ") : "[]"
      )
    }
  ].filter((validation) => validation.enabled);
}
function getNumericValidators(prop) {
  const type = Array.isArray(prop.type) ? prop.type : [prop.type];
  const isNullable = canBeType(type, "null");
  const isIntegral = canBeType(type, "integer") && (type.length === 1 || type.length === 2 && isNullable);
  const isNumeric = canBeType(type, "number", "integer") && (type.length === 1 || type.length === 2 && isNullable);
  if (!isNumeric) {
    return [];
  }
  let exclusiveMax;
  let exclusiveMin;
  if (typeof prop.exclusiveMaximum === "boolean") {
    exclusiveMax = prop.exclusiveMaximum ? prop.maximum : void 0;
  } else {
    exclusiveMax = prop.exclusiveMaximum;
  }
  if (typeof prop.exclusiveMinimum === "boolean") {
    exclusiveMin = prop.exclusiveMinimum ? prop.minimum : void 0;
  } else {
    exclusiveMin = prop.exclusiveMinimum;
  }
  return [
    {
      enabled: exclusiveMax !== void 0 && (prop.maximum === void 0 || exclusiveMax <= prop.maximum),
      isValid: (value) => value < exclusiveMax,
      message: nls.localize("validations.exclusiveMax", "Value must be strictly less than {0}.", exclusiveMax)
    },
    {
      enabled: exclusiveMin !== void 0 && (prop.minimum === void 0 || exclusiveMin >= prop.minimum),
      isValid: (value) => value > exclusiveMin,
      message: nls.localize("validations.exclusiveMin", "Value must be strictly greater than {0}.", exclusiveMin)
    },
    {
      enabled: prop.maximum !== void 0 && (exclusiveMax === void 0 || exclusiveMax > prop.maximum),
      isValid: (value) => value <= prop.maximum,
      message: nls.localize("validations.max", "Value must be less than or equal to {0}.", prop.maximum)
    },
    {
      enabled: prop.minimum !== void 0 && (exclusiveMin === void 0 || exclusiveMin < prop.minimum),
      isValid: (value) => value >= prop.minimum,
      message: nls.localize("validations.min", "Value must be greater than or equal to {0}.", prop.minimum)
    },
    {
      enabled: prop.multipleOf !== void 0,
      isValid: (value) => value % prop.multipleOf === 0,
      message: nls.localize("validations.multipleOf", "Value must be a multiple of {0}.", prop.multipleOf)
    },
    {
      enabled: isIntegral,
      isValid: (value) => value % 1 === 0,
      message: nls.localize("validations.expectedInteger", "Value must be an integer.")
    }
  ].filter((validation) => validation.enabled);
}
function getArrayValidator(prop) {
  if (prop.type === "array" && prop.items && !Array.isArray(prop.items)) {
    const propItems = prop.items;
    if (propItems && !Array.isArray(propItems.type)) {
      const withQuotes = (s) => `'` + s + `'`;
      return (value) => {
        if (!value) {
          return null;
        }
        let message = "";
        if (!Array.isArray(value)) {
          message += nls.localize("validations.arrayIncorrectType", "Incorrect type. Expected an array.");
          message += "\n";
          return message;
        }
        const arrayValue = value;
        if (prop.uniqueItems) {
          if (new Set(arrayValue).size < arrayValue.length) {
            message += nls.localize("validations.stringArrayUniqueItems", "Array has duplicate items");
            message += "\n";
          }
        }
        if (prop.minItems && arrayValue.length < prop.minItems) {
          message += nls.localize("validations.stringArrayMinItem", "Array must have at least {0} items", prop.minItems);
          message += "\n";
        }
        if (prop.maxItems && arrayValue.length > prop.maxItems) {
          message += nls.localize("validations.stringArrayMaxItem", "Array must have at most {0} items", prop.maxItems);
          message += "\n";
        }
        if (propItems.type === "string") {
          if (!isStringArray(arrayValue)) {
            message += nls.localize("validations.stringArrayIncorrectType", "Incorrect type. Expected a string array.");
            message += "\n";
            return message;
          }
          if (typeof propItems.pattern === "string") {
            const patternRegex = toRegExp(propItems.pattern);
            arrayValue.forEach((v) => {
              if (!patternRegex.test(v)) {
                message += propItems.patternErrorMessage || nls.localize(
                  "validations.stringArrayItemPattern",
                  "Value {0} must match regex {1}.",
                  withQuotes(v),
                  withQuotes(propItems.pattern)
                );
              }
            });
          }
          const propItemsEnum = propItems.enum;
          if (propItemsEnum) {
            arrayValue.forEach((v) => {
              if (propItemsEnum.indexOf(v) === -1) {
                message += nls.localize(
                  "validations.stringArrayItemEnum",
                  "Value {0} is not one of {1}",
                  withQuotes(v),
                  "[" + propItemsEnum.map(withQuotes).join(", ") + "]"
                );
                message += "\n";
              }
            });
          }
        } else if (propItems.type === "integer" || propItems.type === "number") {
          arrayValue.forEach((v) => {
            const errorMessage = getErrorsForSchema(propItems, v);
            if (errorMessage) {
              message += `${v}: ${errorMessage}
`;
            }
          });
        }
        return message;
      };
    }
  }
  return null;
}
function getObjectValidator(prop) {
  if (prop.type === "object") {
    const { properties, patternProperties, additionalProperties } = prop;
    return (value) => {
      if (!value) {
        return null;
      }
      const errors = [];
      if (!isObject(value)) {
        errors.push(nls.localize("validations.objectIncorrectType", "Incorrect type. Expected an object."));
      } else {
        Object.keys(value).forEach((key) => {
          const data = value[key];
          if (properties && key in properties) {
            const errorMessage = getErrorsForSchema(properties[key], data);
            if (errorMessage) {
              errors.push(`${key}: ${errorMessage}
`);
            }
            return;
          }
          if (patternProperties) {
            for (const pattern in patternProperties) {
              if (RegExp(pattern).test(key)) {
                const errorMessage = getErrorsForSchema(patternProperties[pattern], data);
                if (errorMessage) {
                  errors.push(`${key}: ${errorMessage}
`);
                }
                return;
              }
            }
          }
          if (additionalProperties === false) {
            errors.push(nls.localize("validations.objectPattern", "Property {0} is not allowed.\n", key));
          } else if (typeof additionalProperties === "object") {
            const errorMessage = getErrorsForSchema(additionalProperties, data);
            if (errorMessage) {
              errors.push(`${key}: ${errorMessage}
`);
            }
          }
        });
      }
      if (errors.length) {
        return prop.errorMessage ? [prop.errorMessage, ...errors].join(" ") : errors.join(" ");
      }
      return "";
    };
  }
  return null;
}
function getErrorsForSchema(propertySchema, data) {
  const validator = createValidator(propertySchema);
  const errorMessage = validator(data);
  return errorMessage;
}
export {
  createValidator,
  getInvalidTypeError
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvcHJlZmVyZW5jZXMvY29tbW9uL3ByZWZlcmVuY2VzVmFsaWRhdGlvbi50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAqIGFzIG5scyBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSlNPTlNjaGVtYVR5cGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9qc29uU2NoZW1hLmpzJztcbmltcG9ydCB7IENvbG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY29sb3IuanMnO1xuaW1wb3J0IHsgaXNPYmplY3QsIGlzVW5kZWZpbmVkT3JOdWxsLCBpc1N0cmluZywgaXNTdHJpbmdBcnJheSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3R5cGVzLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uUHJvcGVydHlTY2hlbWEgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uUmVnaXN0cnkuanMnO1xuXG50eXBlIFZhbGlkYXRvcjxUPiA9IHsgZW5hYmxlZDogYm9vbGVhbjsgaXNWYWxpZDogKHZhbHVlOiBUKSA9PiBib29sZWFuOyBtZXNzYWdlOiBzdHJpbmcgfTtcblxuZnVuY3Rpb24gY2FuQmVUeXBlKHByb3BUeXBlczogKHN0cmluZyB8IHVuZGVmaW5lZClbXSwgLi4udHlwZXM6IEpTT05TY2hlbWFUeXBlW10pOiBib29sZWFuIHtcblx0cmV0dXJuIHR5cGVzLnNvbWUodCA9PiBwcm9wVHlwZXMuaW5jbHVkZXModCkpO1xufVxuXG5mdW5jdGlvbiBpc051bGxPckVtcHR5KHZhbHVlOiB1bmtub3duKTogYm9vbGVhbiB7XG5cdHJldHVybiB2YWx1ZSA9PT0gJycgfHwgaXNVbmRlZmluZWRPck51bGwodmFsdWUpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlVmFsaWRhdG9yKHByb3A6IElDb25maWd1cmF0aW9uUHJvcGVydHlTY2hlbWEpOiAodmFsdWU6IGFueSkgPT4gKHN0cmluZyB8IG51bGwpIHtcblx0Y29uc3QgdHlwZTogKHN0cmluZyB8IHVuZGVmaW5lZClbXSA9IEFycmF5LmlzQXJyYXkocHJvcC50eXBlKSA/IHByb3AudHlwZSA6IFtwcm9wLnR5cGVdO1xuXHRjb25zdCBpc051bGxhYmxlID0gY2FuQmVUeXBlKHR5cGUsICdudWxsJyk7XG5cdGNvbnN0IGlzTnVtZXJpYyA9IChjYW5CZVR5cGUodHlwZSwgJ251bWJlcicpIHx8IGNhbkJlVHlwZSh0eXBlLCAnaW50ZWdlcicpKSAmJiAodHlwZS5sZW5ndGggPT09IDEgfHwgdHlwZS5sZW5ndGggPT09IDIgJiYgaXNOdWxsYWJsZSk7XG5cblx0Y29uc3QgbnVtZXJpY1ZhbGlkYXRpb25zID0gZ2V0TnVtZXJpY1ZhbGlkYXRvcnMocHJvcCk7XG5cdGNvbnN0IHN0cmluZ1ZhbGlkYXRpb25zID0gZ2V0U3RyaW5nVmFsaWRhdG9ycyhwcm9wKTtcblx0Y29uc3QgYXJyYXlWYWxpZGF0b3IgPSBnZXRBcnJheVZhbGlkYXRvcihwcm9wKTtcblx0Y29uc3Qgb2JqZWN0VmFsaWRhdG9yID0gZ2V0T2JqZWN0VmFsaWRhdG9yKHByb3ApO1xuXG5cdHJldHVybiB2YWx1ZSA9PiB7XG5cdFx0aWYgKGlzTnVsbGFibGUgJiYgaXNOdWxsT3JFbXB0eSh2YWx1ZSkpIHsgcmV0dXJuICcnOyB9XG5cblx0XHRjb25zdCBlcnJvcnM6IHN0cmluZ1tdID0gW107XG5cdFx0aWYgKGFycmF5VmFsaWRhdG9yKSB7XG5cdFx0XHRjb25zdCBlcnIgPSBhcnJheVZhbGlkYXRvcih2YWx1ZSk7XG5cdFx0XHRpZiAoZXJyKSB7XG5cdFx0XHRcdGVycm9ycy5wdXNoKGVycik7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKG9iamVjdFZhbGlkYXRvcikge1xuXHRcdFx0Y29uc3QgZXJyID0gb2JqZWN0VmFsaWRhdG9yKHZhbHVlKTtcblx0XHRcdGlmIChlcnIpIHtcblx0XHRcdFx0ZXJyb3JzLnB1c2goZXJyKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAocHJvcC50eXBlID09PSAnYm9vbGVhbicgJiYgdmFsdWUgIT09IHRydWUgJiYgdmFsdWUgIT09IGZhbHNlKSB7XG5cdFx0XHRlcnJvcnMucHVzaChubHMubG9jYWxpemUoJ3ZhbGlkYXRpb25zLmJvb2xlYW5JbmNvcnJlY3RUeXBlJywgJ0luY29ycmVjdCB0eXBlLiBFeHBlY3RlZCBcImJvb2xlYW5cIi4nKSk7XG5cdFx0fVxuXG5cdFx0aWYgKGlzTnVtZXJpYykge1xuXHRcdFx0aWYgKGlzTnVsbE9yRW1wdHkodmFsdWUpIHx8IHR5cGVvZiB2YWx1ZSA9PT0gJ2Jvb2xlYW4nIHx8IEFycmF5LmlzQXJyYXkodmFsdWUpIHx8IGlzTmFOKCt2YWx1ZSkpIHtcblx0XHRcdFx0ZXJyb3JzLnB1c2gobmxzLmxvY2FsaXplKCd2YWxpZGF0aW9ucy5leHBlY3RlZE51bWVyaWMnLCBcIlZhbHVlIG11c3QgYmUgYSBudW1iZXIuXCIpKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGVycm9ycy5wdXNoKC4uLm51bWVyaWNWYWxpZGF0aW9ucy5maWx0ZXIodmFsaWRhdG9yID0+ICF2YWxpZGF0b3IuaXNWYWxpZCgrdmFsdWUpKS5tYXAodmFsaWRhdG9yID0+IHZhbGlkYXRvci5tZXNzYWdlKSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKHByb3AudHlwZSA9PT0gJ3N0cmluZycpIHtcblx0XHRcdGlmIChwcm9wLmVudW0gJiYgIWlzU3RyaW5nQXJyYXkocHJvcC5lbnVtKSkge1xuXHRcdFx0XHRlcnJvcnMucHVzaChubHMubG9jYWxpemUoJ3ZhbGlkYXRpb25zLnN0cmluZ0luY29ycmVjdEVudW1PcHRpb25zJywgJ1RoZSBlbnVtIG9wdGlvbnMgc2hvdWxkIGJlIHN0cmluZ3MsIGJ1dCB0aGVyZSBpcyBhIG5vbi1zdHJpbmcgb3B0aW9uLiBQbGVhc2UgZmlsZSBhbiBpc3N1ZSB3aXRoIHRoZSBleHRlbnNpb24gYXV0aG9yLicpKTtcblx0XHRcdH0gZWxzZSBpZiAoIWlzU3RyaW5nKHZhbHVlKSkge1xuXHRcdFx0XHRlcnJvcnMucHVzaChubHMubG9jYWxpemUoJ3ZhbGlkYXRpb25zLnN0cmluZ0luY29ycmVjdFR5cGUnLCAnSW5jb3JyZWN0IHR5cGUuIEV4cGVjdGVkIFwic3RyaW5nXCIuJykpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0ZXJyb3JzLnB1c2goLi4uc3RyaW5nVmFsaWRhdGlvbnMuZmlsdGVyKHZhbGlkYXRvciA9PiAhdmFsaWRhdG9yLmlzVmFsaWQodmFsdWUpKS5tYXAodmFsaWRhdG9yID0+IHZhbGlkYXRvci5tZXNzYWdlKSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKGVycm9ycy5sZW5ndGgpIHtcblx0XHRcdHJldHVybiBwcm9wLmVycm9yTWVzc2FnZSA/IFtwcm9wLmVycm9yTWVzc2FnZSwgLi4uZXJyb3JzXS5qb2luKCcgJykgOiBlcnJvcnMuam9pbignICcpO1xuXHRcdH1cblxuXHRcdHJldHVybiAnJztcblx0fTtcbn1cblxuLyoqXG4gKiBSZXR1cm5zIGFuIGVycm9yIHN0cmluZyBpZiB0aGUgdmFsdWUgaXMgaW52YWxpZCBhbmQgY2FuJ3QgYmUgZGlzcGxheWVkIGluIHRoZSBzZXR0aW5ncyBVSSBmb3IgdGhlIGdpdmVuIHR5cGUuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRJbnZhbGlkVHlwZUVycm9yKHZhbHVlOiBhbnksIHR5cGU6IHVuZGVmaW5lZCB8IHN0cmluZyB8IHN0cmluZ1tdKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0aWYgKHR5cGVvZiB0eXBlID09PSAndW5kZWZpbmVkJykge1xuXHRcdHJldHVybjtcblx0fVxuXG5cdGNvbnN0IHR5cGVBcnIgPSBBcnJheS5pc0FycmF5KHR5cGUpID8gdHlwZSA6IFt0eXBlXTtcblx0aWYgKCF0eXBlQXJyLnNvbWUoX3R5cGUgPT4gdmFsdWVWYWxpZGF0ZXNBc1R5cGUodmFsdWUsIF90eXBlKSkpIHtcblx0XHRyZXR1cm4gbmxzLmxvY2FsaXplKCdpbnZhbGlkVHlwZUVycm9yJywgXCJTZXR0aW5nIGhhcyBhbiBpbnZhbGlkIHR5cGUsIGV4cGVjdGVkIHswfS4gRml4IGluIEpTT04uXCIsIEpTT04uc3RyaW5naWZ5KHR5cGUpKTtcblx0fVxuXG5cdHJldHVybjtcbn1cblxuZnVuY3Rpb24gdmFsdWVWYWxpZGF0ZXNBc1R5cGUodmFsdWU6IGFueSwgdHlwZTogc3RyaW5nKTogYm9vbGVhbiB7XG5cdGNvbnN0IHZhbHVlVHlwZSA9IHR5cGVvZiB2YWx1ZTtcblx0aWYgKHR5cGUgPT09ICdib29sZWFuJykge1xuXHRcdHJldHVybiB2YWx1ZVR5cGUgPT09ICdib29sZWFuJztcblx0fSBlbHNlIGlmICh0eXBlID09PSAnb2JqZWN0Jykge1xuXHRcdHJldHVybiB2YWx1ZSAmJiAhQXJyYXkuaXNBcnJheSh2YWx1ZSkgJiYgdmFsdWVUeXBlID09PSAnb2JqZWN0Jztcblx0fSBlbHNlIGlmICh0eXBlID09PSAnbnVsbCcpIHtcblx0XHRyZXR1cm4gdmFsdWUgPT09IG51bGw7XG5cdH0gZWxzZSBpZiAodHlwZSA9PT0gJ2FycmF5Jykge1xuXHRcdHJldHVybiBBcnJheS5pc0FycmF5KHZhbHVlKTtcblx0fSBlbHNlIGlmICh0eXBlID09PSAnc3RyaW5nJykge1xuXHRcdHJldHVybiB2YWx1ZVR5cGUgPT09ICdzdHJpbmcnO1xuXHR9IGVsc2UgaWYgKHR5cGUgPT09ICdudW1iZXInIHx8IHR5cGUgPT09ICdpbnRlZ2VyJykge1xuXHRcdHJldHVybiB2YWx1ZVR5cGUgPT09ICdudW1iZXInO1xuXHR9XG5cblx0cmV0dXJuIHRydWU7XG59XG5cbmZ1bmN0aW9uIHRvUmVnRXhwKHBhdHRlcm46IHN0cmluZyk6IFJlZ0V4cCB7XG5cdHRyeSB7XG5cdFx0Ly8gVGhlIHUgZmxhZyBhbGxvd3Mgc3VwcG9ydCBmb3IgYmV0dGVyIFVuaWNvZGUgbWF0Y2hpbmcsXG5cdFx0Ly8gYnV0IGRlcHJlY2F0ZXMgc29tZSBwYXR0ZXJucyBzdWNoIGFzIFtcXHMtOV1cblx0XHQvLyBSZWYgaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvSmF2YVNjcmlwdC9SZWZlcmVuY2UvUmVndWxhcl9leHByZXNzaW9ucy9DaGFyYWN0ZXJfY2xhc3MjZGVzY3JpcHRpb25cblx0XHRyZXR1cm4gbmV3IFJlZ0V4cChwYXR0ZXJuLCAndScpO1xuXHR9IGNhdGNoIChlKSB7XG5cdFx0dHJ5IHtcblx0XHRcdHJldHVybiBuZXcgUmVnRXhwKHBhdHRlcm4pO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdC8vIElmIHRoZSBwYXR0ZXJuIGNhbid0IGJlIHBhcnNlZCBldmVuIHdpdGhvdXQgdGhlICd1JyBmbGFnLFxuXHRcdFx0Ly8ganVzdCBsb2cgdGhlIGVycm9yIHRvIGF2b2lkIHJlbmRlcmluZyB0aGUgZW50aXJlIFNldHRpbmdzIGVkaXRvciBibGFuay5cblx0XHRcdC8vIFJlZiBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMTk1MDU0XG5cdFx0XHRjb25zb2xlLmVycm9yKG5scy5sb2NhbGl6ZSgncmVnZXhQYXJzaW5nRXJyb3InLCBcIkVycm9yIHBhcnNpbmcgdGhlIGZvbGxvd2luZyByZWdleCBib3RoIHdpdGggYW5kIHdpdGhvdXQgdGhlIHUgZmxhZzpcIiksIHBhdHRlcm4pO1xuXHRcdFx0cmV0dXJuIC8uKi87XG5cdFx0fVxuXHR9XG59XG5cbmZ1bmN0aW9uIGdldFN0cmluZ1ZhbGlkYXRvcnMocHJvcDogSUNvbmZpZ3VyYXRpb25Qcm9wZXJ0eVNjaGVtYSkge1xuXHRjb25zdCB1cmlSZWdleCA9IC9eKChbXjovPyNdKz8pOik/KFxcL1xcLyhbXi8/I10qKSk/KFtePyNdKikoXFw/KFteI10qKSk/KCMoLiopKT8vO1xuXHRsZXQgcGF0dGVyblJlZ2V4OiBSZWdFeHAgfCB1bmRlZmluZWQ7XG5cdGlmICh0eXBlb2YgcHJvcC5wYXR0ZXJuID09PSAnc3RyaW5nJykge1xuXHRcdHBhdHRlcm5SZWdleCA9IHRvUmVnRXhwKHByb3AucGF0dGVybik7XG5cdH1cblxuXHRyZXR1cm4gW1xuXHRcdHtcblx0XHRcdGVuYWJsZWQ6IHByb3AubWF4TGVuZ3RoICE9PSB1bmRlZmluZWQsXG5cdFx0XHRpc1ZhbGlkOiAoKHZhbHVlOiB7IGxlbmd0aDogbnVtYmVyIH0pID0+IHZhbHVlLmxlbmd0aCA8PSBwcm9wLm1heExlbmd0aCEpLFxuXHRcdFx0bWVzc2FnZTogbmxzLmxvY2FsaXplKCd2YWxpZGF0aW9ucy5tYXhMZW5ndGgnLCBcIlZhbHVlIG11c3QgYmUgezB9IG9yIGZld2VyIGNoYXJhY3RlcnMgbG9uZy5cIiwgcHJvcC5tYXhMZW5ndGgpXG5cdFx0fSxcblx0XHR7XG5cdFx0XHRlbmFibGVkOiBwcm9wLm1pbkxlbmd0aCAhPT0gdW5kZWZpbmVkLFxuXHRcdFx0aXNWYWxpZDogKCh2YWx1ZTogeyBsZW5ndGg6IG51bWJlciB9KSA9PiB2YWx1ZS5sZW5ndGggPj0gcHJvcC5taW5MZW5ndGghKSxcblx0XHRcdG1lc3NhZ2U6IG5scy5sb2NhbGl6ZSgndmFsaWRhdGlvbnMubWluTGVuZ3RoJywgXCJWYWx1ZSBtdXN0IGJlIHswfSBvciBtb3JlIGNoYXJhY3RlcnMgbG9uZy5cIiwgcHJvcC5taW5MZW5ndGgpXG5cdFx0fSxcblx0XHR7XG5cdFx0XHRlbmFibGVkOiBwYXR0ZXJuUmVnZXggIT09IHVuZGVmaW5lZCxcblx0XHRcdGlzVmFsaWQ6ICgodmFsdWU6IHN0cmluZykgPT4gcGF0dGVyblJlZ2V4IS50ZXN0KHZhbHVlKSksXG5cdFx0XHRtZXNzYWdlOiBwcm9wLnBhdHRlcm5FcnJvck1lc3NhZ2UgfHwgbmxzLmxvY2FsaXplKCd2YWxpZGF0aW9ucy5yZWdleCcsIFwiVmFsdWUgbXVzdCBtYXRjaCByZWdleCBgezB9YC5cIiwgcHJvcC5wYXR0ZXJuKVxuXHRcdH0sXG5cdFx0e1xuXHRcdFx0ZW5hYmxlZDogcHJvcC5mb3JtYXQgPT09ICdjb2xvci1oZXgnLFxuXHRcdFx0aXNWYWxpZDogKCh2YWx1ZTogc3RyaW5nKSA9PiBDb2xvci5Gb3JtYXQuQ1NTLnBhcnNlSGV4KHZhbHVlKSksXG5cdFx0XHRtZXNzYWdlOiBubHMubG9jYWxpemUoJ3ZhbGlkYXRpb25zLmNvbG9yRm9ybWF0JywgXCJJbnZhbGlkIGNvbG9yIGZvcm1hdC4gVXNlICNSR0IsICNSR0JBLCAjUlJHR0JCIG9yICNSUkdHQkJBQS5cIilcblx0XHR9LFxuXHRcdHtcblx0XHRcdGVuYWJsZWQ6IHByb3AuZm9ybWF0ID09PSAndXJpJyB8fCBwcm9wLmZvcm1hdCA9PT0gJ3VyaS1yZWZlcmVuY2UnLFxuXHRcdFx0aXNWYWxpZDogKCh2YWx1ZTogc3RyaW5nKSA9PiAhIXZhbHVlLmxlbmd0aCksXG5cdFx0XHRtZXNzYWdlOiBubHMubG9jYWxpemUoJ3ZhbGlkYXRpb25zLnVyaUVtcHR5JywgXCJVUkkgZXhwZWN0ZWQuXCIpXG5cdFx0fSxcblx0XHR7XG5cdFx0XHRlbmFibGVkOiBwcm9wLmZvcm1hdCA9PT0gJ3VyaScgfHwgcHJvcC5mb3JtYXQgPT09ICd1cmktcmVmZXJlbmNlJyxcblx0XHRcdGlzVmFsaWQ6ICgodmFsdWU6IHN0cmluZykgPT4gdXJpUmVnZXgudGVzdCh2YWx1ZSkpLFxuXHRcdFx0bWVzc2FnZTogbmxzLmxvY2FsaXplKCd2YWxpZGF0aW9ucy51cmlNaXNzaW5nJywgXCJVUkkgaXMgZXhwZWN0ZWQuXCIpXG5cdFx0fSxcblx0XHR7XG5cdFx0XHRlbmFibGVkOiBwcm9wLmZvcm1hdCA9PT0gJ3VyaScsXG5cdFx0XHRpc1ZhbGlkOiAoKHZhbHVlOiBzdHJpbmcpID0+IHtcblx0XHRcdFx0Y29uc3QgbWF0Y2hlcyA9IHZhbHVlLm1hdGNoKHVyaVJlZ2V4KTtcblx0XHRcdFx0cmV0dXJuICEhKG1hdGNoZXMgJiYgbWF0Y2hlc1syXSk7XG5cdFx0XHR9KSxcblx0XHRcdG1lc3NhZ2U6IG5scy5sb2NhbGl6ZSgndmFsaWRhdGlvbnMudXJpU2NoZW1lTWlzc2luZycsIFwiVVJJIHdpdGggYSBzY2hlbWUgaXMgZXhwZWN0ZWQuXCIpXG5cdFx0fSxcblx0XHR7XG5cdFx0XHRlbmFibGVkOiBwcm9wLmVudW0gIT09IHVuZGVmaW5lZCxcblx0XHRcdGlzVmFsaWQ6ICgodmFsdWU6IHN0cmluZykgPT4ge1xuXHRcdFx0XHRyZXR1cm4gcHJvcC5lbnVtIS5pbmNsdWRlcyh2YWx1ZSk7XG5cdFx0XHR9KSxcblx0XHRcdG1lc3NhZ2U6IG5scy5sb2NhbGl6ZSgndmFsaWRhdGlvbnMuaW52YWxpZFN0cmluZ0VudW1WYWx1ZScsIFwiVmFsdWUgaXMgbm90IGFjY2VwdGVkLiBWYWxpZCB2YWx1ZXM6IHswfS5cIixcblx0XHRcdFx0cHJvcC5lbnVtID8gcHJvcC5lbnVtLm1hcChrZXkgPT4gYFwiJHtrZXl9XCJgKS5qb2luKCcsICcpIDogJ1tdJylcblx0XHR9XG5cdF0uZmlsdGVyKHZhbGlkYXRpb24gPT4gdmFsaWRhdGlvbi5lbmFibGVkKTtcbn1cblxuZnVuY3Rpb24gZ2V0TnVtZXJpY1ZhbGlkYXRvcnMocHJvcDogSUNvbmZpZ3VyYXRpb25Qcm9wZXJ0eVNjaGVtYSk6IFZhbGlkYXRvcjxudW1iZXI+W10ge1xuXHRjb25zdCB0eXBlOiAoc3RyaW5nIHwgdW5kZWZpbmVkKVtdID0gQXJyYXkuaXNBcnJheShwcm9wLnR5cGUpID8gcHJvcC50eXBlIDogW3Byb3AudHlwZV07XG5cblx0Y29uc3QgaXNOdWxsYWJsZSA9IGNhbkJlVHlwZSh0eXBlLCAnbnVsbCcpO1xuXHRjb25zdCBpc0ludGVncmFsID0gKGNhbkJlVHlwZSh0eXBlLCAnaW50ZWdlcicpKSAmJiAodHlwZS5sZW5ndGggPT09IDEgfHwgdHlwZS5sZW5ndGggPT09IDIgJiYgaXNOdWxsYWJsZSk7XG5cdGNvbnN0IGlzTnVtZXJpYyA9IGNhbkJlVHlwZSh0eXBlLCAnbnVtYmVyJywgJ2ludGVnZXInKSAmJiAodHlwZS5sZW5ndGggPT09IDEgfHwgdHlwZS5sZW5ndGggPT09IDIgJiYgaXNOdWxsYWJsZSk7XG5cdGlmICghaXNOdW1lcmljKSB7XG5cdFx0cmV0dXJuIFtdO1xuXHR9XG5cblx0bGV0IGV4Y2x1c2l2ZU1heDogbnVtYmVyIHwgdW5kZWZpbmVkO1xuXHRsZXQgZXhjbHVzaXZlTWluOiBudW1iZXIgfCB1bmRlZmluZWQ7XG5cblx0aWYgKHR5cGVvZiBwcm9wLmV4Y2x1c2l2ZU1heGltdW0gPT09ICdib29sZWFuJykge1xuXHRcdGV4Y2x1c2l2ZU1heCA9IHByb3AuZXhjbHVzaXZlTWF4aW11bSA/IHByb3AubWF4aW11bSA6IHVuZGVmaW5lZDtcblx0fSBlbHNlIHtcblx0XHRleGNsdXNpdmVNYXggPSBwcm9wLmV4Y2x1c2l2ZU1heGltdW07XG5cdH1cblxuXHRpZiAodHlwZW9mIHByb3AuZXhjbHVzaXZlTWluaW11bSA9PT0gJ2Jvb2xlYW4nKSB7XG5cdFx0ZXhjbHVzaXZlTWluID0gcHJvcC5leGNsdXNpdmVNaW5pbXVtID8gcHJvcC5taW5pbXVtIDogdW5kZWZpbmVkO1xuXHR9IGVsc2Uge1xuXHRcdGV4Y2x1c2l2ZU1pbiA9IHByb3AuZXhjbHVzaXZlTWluaW11bTtcblx0fVxuXG5cdHJldHVybiBbXG5cdFx0e1xuXHRcdFx0ZW5hYmxlZDogZXhjbHVzaXZlTWF4ICE9PSB1bmRlZmluZWQgJiYgKHByb3AubWF4aW11bSA9PT0gdW5kZWZpbmVkIHx8IGV4Y2x1c2l2ZU1heCA8PSBwcm9wLm1heGltdW0pLFxuXHRcdFx0aXNWYWxpZDogKCh2YWx1ZTogbnVtYmVyKSA9PiB2YWx1ZSA8IGV4Y2x1c2l2ZU1heCEpLFxuXHRcdFx0bWVzc2FnZTogbmxzLmxvY2FsaXplKCd2YWxpZGF0aW9ucy5leGNsdXNpdmVNYXgnLCBcIlZhbHVlIG11c3QgYmUgc3RyaWN0bHkgbGVzcyB0aGFuIHswfS5cIiwgZXhjbHVzaXZlTWF4KVxuXHRcdH0sXG5cdFx0e1xuXHRcdFx0ZW5hYmxlZDogZXhjbHVzaXZlTWluICE9PSB1bmRlZmluZWQgJiYgKHByb3AubWluaW11bSA9PT0gdW5kZWZpbmVkIHx8IGV4Y2x1c2l2ZU1pbiA+PSBwcm9wLm1pbmltdW0pLFxuXHRcdFx0aXNWYWxpZDogKCh2YWx1ZTogbnVtYmVyKSA9PiB2YWx1ZSA+IGV4Y2x1c2l2ZU1pbiEpLFxuXHRcdFx0bWVzc2FnZTogbmxzLmxvY2FsaXplKCd2YWxpZGF0aW9ucy5leGNsdXNpdmVNaW4nLCBcIlZhbHVlIG11c3QgYmUgc3RyaWN0bHkgZ3JlYXRlciB0aGFuIHswfS5cIiwgZXhjbHVzaXZlTWluKVxuXHRcdH0sXG5cdFx0e1xuXHRcdFx0ZW5hYmxlZDogcHJvcC5tYXhpbXVtICE9PSB1bmRlZmluZWQgJiYgKGV4Y2x1c2l2ZU1heCA9PT0gdW5kZWZpbmVkIHx8IGV4Y2x1c2l2ZU1heCA+IHByb3AubWF4aW11bSksXG5cdFx0XHRpc1ZhbGlkOiAoKHZhbHVlOiBudW1iZXIpID0+IHZhbHVlIDw9IHByb3AubWF4aW11bSEpLFxuXHRcdFx0bWVzc2FnZTogbmxzLmxvY2FsaXplKCd2YWxpZGF0aW9ucy5tYXgnLCBcIlZhbHVlIG11c3QgYmUgbGVzcyB0aGFuIG9yIGVxdWFsIHRvIHswfS5cIiwgcHJvcC5tYXhpbXVtKVxuXHRcdH0sXG5cdFx0e1xuXHRcdFx0ZW5hYmxlZDogcHJvcC5taW5pbXVtICE9PSB1bmRlZmluZWQgJiYgKGV4Y2x1c2l2ZU1pbiA9PT0gdW5kZWZpbmVkIHx8IGV4Y2x1c2l2ZU1pbiA8IHByb3AubWluaW11bSksXG5cdFx0XHRpc1ZhbGlkOiAoKHZhbHVlOiBudW1iZXIpID0+IHZhbHVlID49IHByb3AubWluaW11bSEpLFxuXHRcdFx0bWVzc2FnZTogbmxzLmxvY2FsaXplKCd2YWxpZGF0aW9ucy5taW4nLCBcIlZhbHVlIG11c3QgYmUgZ3JlYXRlciB0aGFuIG9yIGVxdWFsIHRvIHswfS5cIiwgcHJvcC5taW5pbXVtKVxuXHRcdH0sXG5cdFx0e1xuXHRcdFx0ZW5hYmxlZDogcHJvcC5tdWx0aXBsZU9mICE9PSB1bmRlZmluZWQsXG5cdFx0XHRpc1ZhbGlkOiAoKHZhbHVlOiBudW1iZXIpID0+IHZhbHVlICUgcHJvcC5tdWx0aXBsZU9mISA9PT0gMCksXG5cdFx0XHRtZXNzYWdlOiBubHMubG9jYWxpemUoJ3ZhbGlkYXRpb25zLm11bHRpcGxlT2YnLCBcIlZhbHVlIG11c3QgYmUgYSBtdWx0aXBsZSBvZiB7MH0uXCIsIHByb3AubXVsdGlwbGVPZilcblx0XHR9LFxuXHRcdHtcblx0XHRcdGVuYWJsZWQ6IGlzSW50ZWdyYWwsXG5cdFx0XHRpc1ZhbGlkOiAoKHZhbHVlOiBudW1iZXIpID0+IHZhbHVlICUgMSA9PT0gMCksXG5cdFx0XHRtZXNzYWdlOiBubHMubG9jYWxpemUoJ3ZhbGlkYXRpb25zLmV4cGVjdGVkSW50ZWdlcicsIFwiVmFsdWUgbXVzdCBiZSBhbiBpbnRlZ2VyLlwiKVxuXHRcdH0sXG5cdF0uZmlsdGVyKHZhbGlkYXRpb24gPT4gdmFsaWRhdGlvbi5lbmFibGVkKTtcbn1cblxuZnVuY3Rpb24gZ2V0QXJyYXlWYWxpZGF0b3IocHJvcDogSUNvbmZpZ3VyYXRpb25Qcm9wZXJ0eVNjaGVtYSk6ICgodmFsdWU6IGFueSkgPT4gKHN0cmluZyB8IG51bGwpKSB8IG51bGwge1xuXHRpZiAocHJvcC50eXBlID09PSAnYXJyYXknICYmIHByb3AuaXRlbXMgJiYgIUFycmF5LmlzQXJyYXkocHJvcC5pdGVtcykpIHtcblx0XHRjb25zdCBwcm9wSXRlbXMgPSBwcm9wLml0ZW1zO1xuXHRcdGlmIChwcm9wSXRlbXMgJiYgIUFycmF5LmlzQXJyYXkocHJvcEl0ZW1zLnR5cGUpKSB7XG5cdFx0XHRjb25zdCB3aXRoUXVvdGVzID0gKHM6IHN0cmluZykgPT4gYCdgICsgcyArIGAnYDtcblx0XHRcdHJldHVybiB2YWx1ZSA9PiB7XG5cdFx0XHRcdGlmICghdmFsdWUpIHtcblx0XHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGxldCBtZXNzYWdlID0gJyc7XG5cblx0XHRcdFx0aWYgKCFBcnJheS5pc0FycmF5KHZhbHVlKSkge1xuXHRcdFx0XHRcdG1lc3NhZ2UgKz0gbmxzLmxvY2FsaXplKCd2YWxpZGF0aW9ucy5hcnJheUluY29ycmVjdFR5cGUnLCAnSW5jb3JyZWN0IHR5cGUuIEV4cGVjdGVkIGFuIGFycmF5LicpO1xuXHRcdFx0XHRcdG1lc3NhZ2UgKz0gJ1xcbic7XG5cdFx0XHRcdFx0cmV0dXJuIG1lc3NhZ2U7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCBhcnJheVZhbHVlID0gdmFsdWUgYXMgdW5rbm93bltdO1xuXHRcdFx0XHRpZiAocHJvcC51bmlxdWVJdGVtcykge1xuXHRcdFx0XHRcdGlmIChuZXcgU2V0KGFycmF5VmFsdWUpLnNpemUgPCBhcnJheVZhbHVlLmxlbmd0aCkge1xuXHRcdFx0XHRcdFx0bWVzc2FnZSArPSBubHMubG9jYWxpemUoJ3ZhbGlkYXRpb25zLnN0cmluZ0FycmF5VW5pcXVlSXRlbXMnLCAnQXJyYXkgaGFzIGR1cGxpY2F0ZSBpdGVtcycpO1xuXHRcdFx0XHRcdFx0bWVzc2FnZSArPSAnXFxuJztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAocHJvcC5taW5JdGVtcyAmJiBhcnJheVZhbHVlLmxlbmd0aCA8IHByb3AubWluSXRlbXMpIHtcblx0XHRcdFx0XHRtZXNzYWdlICs9IG5scy5sb2NhbGl6ZSgndmFsaWRhdGlvbnMuc3RyaW5nQXJyYXlNaW5JdGVtJywgJ0FycmF5IG11c3QgaGF2ZSBhdCBsZWFzdCB7MH0gaXRlbXMnLCBwcm9wLm1pbkl0ZW1zKTtcblx0XHRcdFx0XHRtZXNzYWdlICs9ICdcXG4nO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKHByb3AubWF4SXRlbXMgJiYgYXJyYXlWYWx1ZS5sZW5ndGggPiBwcm9wLm1heEl0ZW1zKSB7XG5cdFx0XHRcdFx0bWVzc2FnZSArPSBubHMubG9jYWxpemUoJ3ZhbGlkYXRpb25zLnN0cmluZ0FycmF5TWF4SXRlbScsICdBcnJheSBtdXN0IGhhdmUgYXQgbW9zdCB7MH0gaXRlbXMnLCBwcm9wLm1heEl0ZW1zKTtcblx0XHRcdFx0XHRtZXNzYWdlICs9ICdcXG4nO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKHByb3BJdGVtcy50eXBlID09PSAnc3RyaW5nJykge1xuXHRcdFx0XHRcdGlmICghaXNTdHJpbmdBcnJheShhcnJheVZhbHVlKSkge1xuXHRcdFx0XHRcdFx0bWVzc2FnZSArPSBubHMubG9jYWxpemUoJ3ZhbGlkYXRpb25zLnN0cmluZ0FycmF5SW5jb3JyZWN0VHlwZScsICdJbmNvcnJlY3QgdHlwZS4gRXhwZWN0ZWQgYSBzdHJpbmcgYXJyYXkuJyk7XG5cdFx0XHRcdFx0XHRtZXNzYWdlICs9ICdcXG4nO1xuXHRcdFx0XHRcdFx0cmV0dXJuIG1lc3NhZ2U7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0aWYgKHR5cGVvZiBwcm9wSXRlbXMucGF0dGVybiA9PT0gJ3N0cmluZycpIHtcblx0XHRcdFx0XHRcdGNvbnN0IHBhdHRlcm5SZWdleCA9IHRvUmVnRXhwKHByb3BJdGVtcy5wYXR0ZXJuKTtcblx0XHRcdFx0XHRcdGFycmF5VmFsdWUuZm9yRWFjaCh2ID0+IHtcblx0XHRcdFx0XHRcdFx0aWYgKCFwYXR0ZXJuUmVnZXgudGVzdCh2KSkge1xuXHRcdFx0XHRcdFx0XHRcdG1lc3NhZ2UgKz1cblx0XHRcdFx0XHRcdFx0XHRcdHByb3BJdGVtcy5wYXR0ZXJuRXJyb3JNZXNzYWdlIHx8XG5cdFx0XHRcdFx0XHRcdFx0XHRubHMubG9jYWxpemUoXG5cdFx0XHRcdFx0XHRcdFx0XHRcdCd2YWxpZGF0aW9ucy5zdHJpbmdBcnJheUl0ZW1QYXR0ZXJuJyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0J1ZhbHVlIHswfSBtdXN0IG1hdGNoIHJlZ2V4IHsxfS4nLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHR3aXRoUXVvdGVzKHYpLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHR3aXRoUXVvdGVzKHByb3BJdGVtcy5wYXR0ZXJuISlcblx0XHRcdFx0XHRcdFx0XHRcdCk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGNvbnN0IHByb3BJdGVtc0VudW0gPSBwcm9wSXRlbXMuZW51bTtcblx0XHRcdFx0XHRpZiAocHJvcEl0ZW1zRW51bSkge1xuXHRcdFx0XHRcdFx0YXJyYXlWYWx1ZS5mb3JFYWNoKHYgPT4ge1xuXHRcdFx0XHRcdFx0XHRpZiAocHJvcEl0ZW1zRW51bS5pbmRleE9mKHYpID09PSAtMSkge1xuXHRcdFx0XHRcdFx0XHRcdG1lc3NhZ2UgKz0gbmxzLmxvY2FsaXplKFxuXHRcdFx0XHRcdFx0XHRcdFx0J3ZhbGlkYXRpb25zLnN0cmluZ0FycmF5SXRlbUVudW0nLFxuXHRcdFx0XHRcdFx0XHRcdFx0J1ZhbHVlIHswfSBpcyBub3Qgb25lIG9mIHsxfScsXG5cdFx0XHRcdFx0XHRcdFx0XHR3aXRoUXVvdGVzKHYpLFxuXHRcdFx0XHRcdFx0XHRcdFx0J1snICsgcHJvcEl0ZW1zRW51bS5tYXAod2l0aFF1b3Rlcykuam9pbignLCAnKSArICddJ1xuXHRcdFx0XHRcdFx0XHRcdCk7XG5cdFx0XHRcdFx0XHRcdFx0bWVzc2FnZSArPSAnXFxuJztcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2UgaWYgKHByb3BJdGVtcy50eXBlID09PSAnaW50ZWdlcicgfHwgcHJvcEl0ZW1zLnR5cGUgPT09ICdudW1iZXInKSB7XG5cdFx0XHRcdFx0YXJyYXlWYWx1ZS5mb3JFYWNoKHYgPT4ge1xuXHRcdFx0XHRcdFx0Y29uc3QgZXJyb3JNZXNzYWdlID0gZ2V0RXJyb3JzRm9yU2NoZW1hKHByb3BJdGVtcywgdik7XG5cdFx0XHRcdFx0XHRpZiAoZXJyb3JNZXNzYWdlKSB7XG5cdFx0XHRcdFx0XHRcdG1lc3NhZ2UgKz0gYCR7dn06ICR7ZXJyb3JNZXNzYWdlfVxcbmA7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm4gbWVzc2FnZTtcblx0XHRcdH07XG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIG51bGw7XG59XG5cbmZ1bmN0aW9uIGdldE9iamVjdFZhbGlkYXRvcihwcm9wOiBJQ29uZmlndXJhdGlvblByb3BlcnR5U2NoZW1hKTogKCh2YWx1ZTogYW55KSA9PiAoc3RyaW5nIHwgbnVsbCkpIHwgbnVsbCB7XG5cdGlmIChwcm9wLnR5cGUgPT09ICdvYmplY3QnKSB7XG5cdFx0Y29uc3QgeyBwcm9wZXJ0aWVzLCBwYXR0ZXJuUHJvcGVydGllcywgYWRkaXRpb25hbFByb3BlcnRpZXMgfSA9IHByb3A7XG5cdFx0cmV0dXJuIHZhbHVlID0+IHtcblx0XHRcdGlmICghdmFsdWUpIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGVycm9yczogc3RyaW5nW10gPSBbXTtcblxuXHRcdFx0aWYgKCFpc09iamVjdCh2YWx1ZSkpIHtcblx0XHRcdFx0ZXJyb3JzLnB1c2gobmxzLmxvY2FsaXplKCd2YWxpZGF0aW9ucy5vYmplY3RJbmNvcnJlY3RUeXBlJywgJ0luY29ycmVjdCB0eXBlLiBFeHBlY3RlZCBhbiBvYmplY3QuJykpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0T2JqZWN0LmtleXModmFsdWUpLmZvckVhY2goKGtleTogc3RyaW5nKSA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgZGF0YSA9IHZhbHVlW2tleV07XG5cdFx0XHRcdFx0aWYgKHByb3BlcnRpZXMgJiYga2V5IGluIHByb3BlcnRpZXMpIHtcblx0XHRcdFx0XHRcdGNvbnN0IGVycm9yTWVzc2FnZSA9IGdldEVycm9yc0ZvclNjaGVtYShwcm9wZXJ0aWVzW2tleV0sIGRhdGEpO1xuXHRcdFx0XHRcdFx0aWYgKGVycm9yTWVzc2FnZSkge1xuXHRcdFx0XHRcdFx0XHRlcnJvcnMucHVzaChgJHtrZXl9OiAke2Vycm9yTWVzc2FnZX1cXG5gKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRpZiAocGF0dGVyblByb3BlcnRpZXMpIHtcblx0XHRcdFx0XHRcdGZvciAoY29uc3QgcGF0dGVybiBpbiBwYXR0ZXJuUHJvcGVydGllcykge1xuXHRcdFx0XHRcdFx0XHRpZiAoUmVnRXhwKHBhdHRlcm4pLnRlc3Qoa2V5KSkge1xuXHRcdFx0XHRcdFx0XHRcdGNvbnN0IGVycm9yTWVzc2FnZSA9IGdldEVycm9yc0ZvclNjaGVtYShwYXR0ZXJuUHJvcGVydGllc1twYXR0ZXJuXSwgZGF0YSk7XG5cdFx0XHRcdFx0XHRcdFx0aWYgKGVycm9yTWVzc2FnZSkge1xuXHRcdFx0XHRcdFx0XHRcdFx0ZXJyb3JzLnB1c2goYCR7a2V5fTogJHtlcnJvck1lc3NhZ2V9XFxuYCk7XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGlmIChhZGRpdGlvbmFsUHJvcGVydGllcyA9PT0gZmFsc2UpIHtcblx0XHRcdFx0XHRcdGVycm9ycy5wdXNoKG5scy5sb2NhbGl6ZSgndmFsaWRhdGlvbnMub2JqZWN0UGF0dGVybicsICdQcm9wZXJ0eSB7MH0gaXMgbm90IGFsbG93ZWQuXFxuJywga2V5KSk7XG5cdFx0XHRcdFx0fSBlbHNlIGlmICh0eXBlb2YgYWRkaXRpb25hbFByb3BlcnRpZXMgPT09ICdvYmplY3QnKSB7XG5cdFx0XHRcdFx0XHRjb25zdCBlcnJvck1lc3NhZ2UgPSBnZXRFcnJvcnNGb3JTY2hlbWEoYWRkaXRpb25hbFByb3BlcnRpZXMsIGRhdGEpO1xuXHRcdFx0XHRcdFx0aWYgKGVycm9yTWVzc2FnZSkge1xuXHRcdFx0XHRcdFx0XHRlcnJvcnMucHVzaChgJHtrZXl9OiAke2Vycm9yTWVzc2FnZX1cXG5gKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoZXJyb3JzLmxlbmd0aCkge1xuXHRcdFx0XHRyZXR1cm4gcHJvcC5lcnJvck1lc3NhZ2UgPyBbcHJvcC5lcnJvck1lc3NhZ2UsIC4uLmVycm9yc10uam9pbignICcpIDogZXJyb3JzLmpvaW4oJyAnKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuICcnO1xuXHRcdH07XG5cdH1cblxuXHRyZXR1cm4gbnVsbDtcbn1cblxuZnVuY3Rpb24gZ2V0RXJyb3JzRm9yU2NoZW1hKHByb3BlcnR5U2NoZW1hOiBJQ29uZmlndXJhdGlvblByb3BlcnR5U2NoZW1hLCBkYXRhOiBhbnkpOiBzdHJpbmcgfCBudWxsIHtcblx0Y29uc3QgdmFsaWRhdG9yID0gY3JlYXRlVmFsaWRhdG9yKHByb3BlcnR5U2NoZW1hKTtcblx0Y29uc3QgZXJyb3JNZXNzYWdlID0gdmFsaWRhdG9yKGRhdGEpO1xuXHRyZXR1cm4gZXJyb3JNZXNzYWdlO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsWUFBWSxTQUFTO0FBRXJCLFNBQVMsYUFBYTtBQUN0QixTQUFTLFVBQVUsbUJBQW1CLFVBQVUscUJBQXFCO0FBS3JFLFNBQVMsVUFBVSxjQUFzQyxPQUFrQztBQUMxRixTQUFPLE1BQU0sS0FBSyxPQUFLLFVBQVUsU0FBUyxDQUFDLENBQUM7QUFDN0M7QUFFQSxTQUFTLGNBQWMsT0FBeUI7QUFDL0MsU0FBTyxVQUFVLE1BQU0sa0JB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
