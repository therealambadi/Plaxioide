var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);
import { SettingMatchType, SettingKeyMatchTypes } from "../../../services/preferences/common/preferences.js";
import { distinct } from "../../../../base/common/arrays.js";
import * as strings from "../../../../base/common/strings.js";
import { matchesContiguousSubString, matchesSubString, matchesWords } from "../../../../base/common/filters.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { IPreferencesSearchService } from "../common/preferences.js";
import { IExtensionManagementService } from "../../../../platform/extensionManagement/common/extensionManagement.js";
import { IWorkbenchExtensionEnablementService } from "../../../services/extensionManagement/common/extensionManagement.js";
import { ExtensionType } from "../../../../platform/extensions/common/extensions.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IAiRelatedInformationService, RelatedInformationType } from "../../../services/aiRelatedInformation/common/aiRelatedInformation.js";
import { TfIdfCalculator } from "../../../../base/common/tfIdf.js";
import { nullRange } from "../../../services/preferences/common/preferencesModels.js";
let PreferencesSearchService = class extends Disposable {
  constructor(instantiationService, configurationService, extensionManagementService, extensionEnablementService) {
    super();
    this.instantiationService = instantiationService;
    this.configurationService = configurationService;
    this.extensionManagementService = extensionManagementService;
    this.extensionEnablementService = extensionEnablementService;
    this._installedExtensions = this.extensionManagementService.getInstalled(ExtensionType.User).then((exts) => {
      return exts.filter((ext) => this.extensionEnablementService.isEnabled(ext)).filter((ext) => ext.manifest && ext.manifest.contributes && ext.manifest.contributes.configuration).filter((ext) => !!ext.identifier.uuid);
    });
  }
  get remoteSearchAllowed() {
    const workbenchSettings = this.configurationService.getValue().workbench.settings;
    return workbenchSettings.enableNaturalLanguageSearch;
  }
  getRemoteSearchProvider(filter) {
    if (!this.remoteSearchAllowed) {
      return void 0;
    }
    this._remoteSearchProvider ??= this.instantiationService.createInstance(RemoteSearchProvider);
    this._remoteSearchProvider.setFilter(filter);
    return this._remoteSearchProvider;
  }
  getLocalSearchProvider(filter) {
    return this.instantiationService.createInstance(LocalSearchProvider, filter);
  }
};
PreferencesSearchService = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, IExtensionManagementService),
  __decorateParam(3, IWorkbenchExtensionEnablementService)
], PreferencesSearchService);
function cleanFilter(filter) {
  return filter.replace(/[":]/g, " ").replace(/  /g, " ").trim();
}
let LocalSearchProvider = class {
  constructor(_filter, configurationService) {
    this._filter = _filter;
    this.configurationService = configurationService;
    this._filter = cleanFilter(this._filter);
  }
  searchModel(preferencesModel, token) {
    if (!this._filter) {
      return Promise.resolve(null);
    }
    const settingMatcher = (setting) => {
      let { matches, matchType, keyMatchScore } = new SettingMatches(
        this._filter,
        setting,
        true,
        this.configurationService
      );
      if (matchType === SettingMatchType.None || matches.length === 0) {
        return null;
      }
      if (strings.equalsIgnoreCase(this._filter, setting.key)) {
        matchType = SettingMatchType.ExactMatch;
      }
      return {
        matches,
        matchType,
        keyMatchScore,
        score: 0
        // only used for RemoteSearchProvider matches.
      };
    };
    const filterMatches = preferencesModel.filterSettings(this._filter, this.getGroupFilter(this._filter), settingMatcher);
    const topKeyMatchType = Math.max(...filterMatches.map((m) => m.matchType & SettingKeyMatchTypes));
    const alwaysAllowedMatchTypes = SettingMatchType.DescriptionOrValueMatch | SettingMatchType.LanguageTagSettingMatch;
    const filteredMatches = filterMatches.filter((m) => m.matchType & topKeyMatchType || m.matchType & alwaysAllowedMatchTypes || m.matchType === SettingMatchType.ExactMatch);
    return Promise.resolve({
      filterMatches: filteredMatches,
      exactMatch: filteredMatches.some((m) => m.matchType === SettingMatchType.ExactMatch)
    });
  }
  getGroupFilter(filter) {
    const regex = strings.createRegExp(filter, false, { global: true });
    return (group) => {
      return group.id !== "defaultOverrides" && regex.test(group.title);
    };
  }
};
LocalSearchProvider = __decorateClass([
  __decorateParam(1, IConfigurationService)
], LocalSearchProvider);
class SettingMatches {
  constructor(searchString, setting, searchDescription, configurationService) {
    this.searchDescription = searchDescription;
    this.configurationService = configurationService;
    this.matchType = SettingMatchType.None;
    /**
     * A match score for key matches to allow comparing key matches against each other.
     * Otherwise, all key matches are treated the same, and sorting is done by ToC order.
     */
    this.keyMatchScore = 0;
    this.matches = distinct(this._findMatchesInSetting(searchString, setting), (match) => `${match.startLineNumber}_${match.startColumn}_${match.endLineNumber}_${match.endColumn}_`);
  }
  _findMatchesInSetting(searchString, setting) {
    const result = this._doFindMatchesInSetting(searchString, setting);
    return result;
  }
  _keyToLabel(settingId) {
    const label = settingId.replace(/[-._]/g, " ").replace(/([a-z]+)([A-Z])/g, "$1 $2").replace(/([A-Za-z]+)(\d+)/g, "$1 $2").replace(/(\d+)([A-Za-z]+)/g, "$1 $2").toLowerCase();
    return label;
  }
  _toAlphaNumeric(s) {
    return s.replace(/[^A-Za-z0-9]+/g, "");
  }
  _doFindMatchesInSetting(searchString, setting) {
    const descriptionMatchingWords = /* @__PURE__ */ new Map();
    const keyMatchingWords = /* @__PURE__ */ new Map();
    const valueMatchingWords = /* @__PURE__ */ new Map();
    const settingKeyAsWords = this._keyToLabel(setting.key);
    const queryWords = new Set(searchString.split(" "));
    for (const word of queryWords) {
      const keyMatches = matchesWords(word, settingKeyAsWords, true);
      if (keyMatches?.length) {
        keyMatchingWords.set(word, keyMatches.map((match) => this.toKeyRange(setting, match)));
      }
    }
    if (keyMatchingWords.size === queryWords.size) {
      this.matchType |= SettingMatchType.AllWordsInSettingsLabel;
    } else if (keyMatchingWords.size >= 2) {
      this.matchType |= SettingMatchType.ContiguousWordsInSettingsLabel;
      this.keyMatchScore = keyMatchingWords.size;
    }
    const searchStringAlphaNumeric = this._toAlphaNumeric(searchString);
    const keyAlphaNumeric = this._toAlphaNumeric(setting.key);
    const keyIdMatches = matchesContiguousSubString(searchStringAlphaNumeric, keyAlphaNumeric);
    if (keyIdMatches?.length) {
      keyMatchingWords.set(setting.key, keyIdMatches.map((match) => this.toKeyRange(setting, match)));
      this.matchType |= SettingMatchType.ContiguousQueryInSettingId;
    }
    if (this.matchType === SettingMatchType.None) {
      keyMatchingWords.clear();
      for (const word of queryWords) {
        const keyMatches = matchesWords(word, settingKeyAsWords, false);
        if (keyMatches?.length) {
          keyMatchingWords.set(word, keyMatches.map((match) => this.toKeyRange(setting, match)));
        }
      }
      if (keyMatchingWords.size >= 2 || keyMatchingWords.size === 1 && queryWords.size === 1) {
        this.matchType |= SettingMatchType.NonContiguousWordsInSettingsLabel;
        this.keyMatchScore = keyMatchingWords.size;
      } else {
        const keyIdMatches2 = matchesSubString(searchStringAlphaNumeric, keyAlphaNumeric);
        if (keyIdMatches2?.length) {
          keyMatchingWords.set(setting.key, keyIdMatches2.map((match) => this.toKeyRange(setting, match)));
          this.matchType |= SettingMatchType.NonContiguousQueryInSettingId;
        }
      }
    }
    if (setting.overrides?.length && this.matchType !== SettingMatchType.None) {
      this.matchType = SettingMatchType.LanguageTagSettingMatch;
      const keyRanges2 = keyMatchingWords.size ? Array.from(keyMatchingWords.values()).flat() : [];
      return [...keyRanges2];
    }
    const hasContiguousKeyMatchTypes = this.matchType >= SettingMatchType.ContiguousWordsInSettingsLabel;
    if (this.searchDescription && !hasContiguousKeyMatchTypes) {
      for (const word of queryWords) {
        for (let lineIndex = 0; lineIndex < setting.description.length; lineIndex++) {
          const descriptionMatches = matchesContiguousSubString(word, setting.description[lineIndex]);
          if (descriptionMatches?.length) {
            descriptionMatchingWords.set(word, descriptionMatches.map((match) => this.toDescriptionRange(setting, match, lineIndex)));
          }
        }
      }
      if (descriptionMatchingWords.size === queryWords.size) {
        this.matchType |= SettingMatchType.DescriptionOrValueMatch;
      } else {
        descriptionMatchingWords.clear();
      }
    }
    if (!hasContiguousKeyMatchTypes) {
      if (setting.enum?.length) {
        for (const option of setting.enum) {
          if (typeof option !== "string") {
            continue;
          }
          valueMatchingWords.clear();
          for (const word of queryWords) {
            const valueMatches = matchesContiguousSubString(word, option);
            if (valueMatches?.length) {
              valueMatchingWords.set(word, valueMatches.map((match) => this.toValueRange(setting, match)));
            }
          }
          if (valueMatchingWords.size === queryWords.size) {
            this.matchType |= SettingMatchType.DescriptionOrValueMatch;
            break;
          } else {
            valueMatchingWords.clear();
          }
        }
      } else {
        const settingValue = this.configurationService.getValue(setting.key);
        if (typeof settingValue === "string") {
          for (const word of queryWords) {
            const valueMatches = matchesContiguousSubString(word, settingValue);
            if (valueMatches?.length) {
              valueMatchingWords.set(word, valueMatches.map((match) => this.toValueRange(setting, match)));
            }
          }
          if (valueMatchingWords.size === queryWords.size) {
            this.matchType |= SettingMatchType.DescriptionOrValueMatch;
          } else {
            valueMatchingWords.clear();
          }
        }
      }
    }
    const descriptionRanges = descriptionMatchingWords.size ? Array.from(descriptionMatchingWords.values()).flat() : [];
    const keyRanges = keyMatchingWords.size ? Array.from(keyMatchingWords.values()).flat() : [];
    const valueRanges = valueMatchingWords.size ? Array.from(valueMatchingWords.values()).flat() : [];
    return [...descriptionRanges, ...keyRanges, ...valueRanges];
  }
  toKeyRange(setting, match) {
    return {
      startLineNumber: setting.keyRange.startLineNumber,
      startColumn: setting.keyRange.startColumn + match.start,
      endLineNumber: setting.keyRange.startLineNumber,
      endColumn: setting.keyRange.startColumn + match.end
    };
  }
  toDescriptionRange(setting, match, lineIndex) {
    const descriptionRange = setting.descriptionRanges[lineIndex];
    if (!descriptionRange) {
      return nullRange;
    }
    return {
      startLineNumber: descriptionRange.startLineNumber,
      startColumn: descriptionRange.startColumn + match.start,
      endLineNumber: descriptionRange.endLineNumber,
      endColumn: descriptionRange.startColumn + match.end
    };
  }
  toValueRange(setting, match) {
    return {
      startLineNumber: setting.valueRange.startLineNumber,
      startColumn: setting.valueRange.startColumn + match.start + 1,
      endLineNumber: setting.valueRange.startLineNumber,
      endColumn: setting.valueRange.startColumn + match.end + 1
    };
  }
}
class AiRelatedInformationSearchKeysProvider {
  constructor(aiRelatedInformationService) {
    this.aiRelatedInformationService = aiRelatedInformationService;
    this.settingKeys = [];
    this.settingsRecord = {};
  }
  updateModel(preferencesModel) {
    if (preferencesModel === this.currentPreferencesModel) {
      return;
    }
    this.currentPreferencesModel = preferencesModel;
    this.refresh();
  }
  refresh() {
    this.settingKeys = [];
    this.settingsRecord = {};
    if (!this.currentPreferencesModel || !this.aiRelatedInformationService.isEnabled()) {
      return;
    }
    for (const group of this.currentPreferencesModel.settingsGroups) {
      if (group.id === "mostCommonlyUsed") {
        continue;
      }
      for (const section of group.sections) {
        for (const setting of section.settings) {
          this.settingKeys.push(setting.key);
          this.settingsRecord[setting.key] = setting;
        }
      }
    }
  }
  getSettingKeys() {
    return this.settingKeys;
  }
  getSettingsRecord() {
    return this.settingsRecord;
  }
}
let AiRelatedInformationSearchProvider = class {
  constructor(aiRelatedInformationService) {
    this.aiRelatedInformationService = aiRelatedInformationService;
    this._filter = "";
    this._keysProvider = new AiRelatedInformationSearchKeysProvider(aiRelatedInformationService);
  }
  setFilter(filter) {
    this._filter = cleanFilter(filter);
  }
  async searchModel(preferencesModel, token) {
    if (!this._filter || !this.aiRelatedInformationService.isEnabled()) {
      return null;
    }
    this._keysProvider.updateModel(preferencesModel);
    return {
      filterMatches: await this.getAiRelatedInformationItems(token),
      exactMatch: false
    };
  }
  async getAiRelatedInformationItems(token) {
    const settingsRecord = this._keysProvider.getSettingsRecord();
    const filterMatches = [];
    const relatedInformation = await this.aiRelatedInformationService.getRelatedInformation(
      this._filter,
      [RelatedInformationType.SettingInformation],
      token
    );
    relatedInformation.sort((a, b) => b.weight - a.weight);
    for (const info of relatedInformation) {
      if (filterMatches.length === AiRelatedInformationSearchProvider.AI_RELATED_INFORMATION_MAX_PICKS) {
        break;
      }
      const pick = info.setting;
      filterMatches.push({
        setting: settingsRecord[pick],
        matches: [settingsRecord[pick].range],
        matchType: SettingMatchType.RemoteMatch,
        keyMatchScore: 0,
        score: info.weight
      });
    }
    return filterMatches;
  }
};
AiRelatedInformationSearchProvider.AI_RELATED_INFORMATION_MAX_PICKS = 5;
AiRelatedInformationSearchProvider = __decorateClass([
  __decorateParam(0, IAiRelatedInformationService)
], AiRelatedInformationSearchProvider);
const _TfIdfSearchProvider = class _TfIdfSearchProvider {
  constructor() {
    this._filter = "";
    this._documents = [];
    this._settingsRecord = {};
  }
  setFilter(filter) {
    this._filter = cleanFilter(filter);
  }
  keyToLabel(settingId) {
    const label = settingId.replace(/[-._]/g, " ").replace(/([a-z]+)([A-Z])/g, "$1 $2").replace(/([A-Za-z]+)(\d+)/g, "$1 $2").replace(/(\d+)([A-Za-z]+)/g, "$1 $2").toLowerCase();
    return label;
  }
  settingItemToEmbeddingString(item) {
    let result = `Setting Id: ${item.key}
`;
    result += `Label: ${this.keyToLabel(item.key)}
`;
    result += `Description: ${item.description}
`;
    return result;
  }
  async searchModel(preferencesModel, token) {
    if (!this._filter) {
      return null;
    }
    if (this._currentPreferencesModel !== preferencesModel) {
      this._currentPreferencesModel = preferencesModel;
      this._documents = [];
      this._settingsRecord = {};
      for (const group of preferencesModel.settingsGroups) {
        if (group.id === "mostCommonlyUsed") {
          continue;
        }
        for (const section of group.sections) {
          for (const setting of section.settings) {
            this._documents.push({
              key: setting.key,
              textChunks: [this.settingItemToEmbeddingString(setting)]
            });
            this._settingsRecord[setting.key] = setting;
          }
        }
      }
    }
    return {
      filterMatches: await this.getTfIdfItems(token),
      exactMatch: false
    };
  }
  async getTfIdfItems(token) {
    const filterMatches = [];
    const tfIdfCalculator = new TfIdfCalculator();
    tfIdfCalculator.updateDocuments(this._documents);
    const tfIdfRankings = tfIdfCalculator.calculateScores(this._filter, token);
    tfIdfRankings.sort((a, b) => b.score - a.score);
    const maxScore = tfIdfRankings[0].score;
    if (maxScore < _TfIdfSearchProvider.TF_IDF_PRE_NORMALIZE_THRESHOLD) {
      return [];
    }
    for (const info of tfIdfRankings) {
      if (info.score / maxScore < _TfIdfSearchProvider.TF_IDF_POST_NORMALIZE_THRESHOLD || filterMatches.length === _TfIdfSearchProvider.TF_IDF_MAX_PICKS) {
        break;
      }
      const pick = info.key;
      filterMatches.push({
        setting: this._settingsRecord[pick],
        matches: [this._settingsRecord[pick].range],
        matchType: SettingMatchType.RemoteMatch,
        keyMatchScore: 0,
        score: info.score
      });
    }
    return filterMatches;
  }
};
_TfIdfSearchProvider.TF_IDF_PRE_NORMALIZE_THRESHOLD = 50;
_TfIdfSearchProvider.TF_IDF_POST_NORMALIZE_THRESHOLD = 0.7;
_TfIdfSearchProvider.TF_IDF_MAX_PICKS = 5;
let TfIdfSearchProvider = _TfIdfSearchProvider;
let RemoteSearchProvider = class {
  constructor(aiRelatedInformationService) {
    this.aiRelatedInformationService = aiRelatedInformationService;
    this.filter = "";
  }
  initializeSearchProviders() {
    if (this.aiRelatedInformationService.isEnabled()) {
      this.adaSearchProvider ??= new AiRelatedInformationSearchProvider(this.aiRelatedInformationService);
    }
    this.tfIdfSearchProvider ??= new TfIdfSearchProvider();
  }
  setFilter(filter) {
    this.initializeSearchProviders();
    this.filter = filter;
    if (this.adaSearchProvider) {
      this.adaSearchProvider.setFilter(filter);
    }
    this.tfIdfSearchProvider.setFilter(filter);
  }
  async searchModel(preferencesModel, token) {
    if (!this.filter) {
      return null;
    }
    if (!this.adaSearchProvider) {
      return this.tfIdfSearchProvider.searchModel(preferencesModel, token);
    }
    let results = await this.adaSearchProvider.searchModel(preferencesModel, token);
    if (results?.filterMatches.length) {
      return results;
    }
    if (!token.isCancellationRequested) {
      results = await this.tfIdfSearchProvider.searchModel(preferencesModel, token);
      if (results?.filterMatches.length) {
        return results;
      }
    }
    return null;
  }
};
RemoteSearchProvider = __decorateClass([
  __decorateParam(0, IAiRelatedInformationService)
], RemoteSearchProvider);
registerSingleton(IPreferencesSearchService, PreferencesSearchService, InstantiationType.Delayed);
export {
  LocalSearchProvider,
  PreferencesSearchService,
  SettingMatches
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9wcmVmZXJlbmNlcy9icm93c2VyL3ByZWZlcmVuY2VzU2VhcmNoLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgSVNldHRpbmdzRWRpdG9yTW9kZWwsIElTZXR0aW5nLCBJU2V0dGluZ3NHcm91cCwgSVNlYXJjaFJlc3VsdCwgSUdyb3VwRmlsdGVyLCBTZXR0aW5nTWF0Y2hUeXBlLCBJU2V0dGluZ01hdGNoLCBTZXR0aW5nS2V5TWF0Y2hUeXBlcywgSVNldHRpbmdNYXRjaGVyIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvcHJlZmVyZW5jZXMvY29tbW9uL3ByZWZlcmVuY2VzLmpzJztcbmltcG9ydCB7IElSYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBkaXN0aW5jdCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FycmF5cy5qcyc7XG5pbXBvcnQgKiBhcyBzdHJpbmdzIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3N0cmluZ3MuanMnO1xuaW1wb3J0IHsgSU1hdGNoLCBtYXRjaGVzQ29udGlndW91c1N1YlN0cmluZywgbWF0Y2hlc1N1YlN0cmluZywgbWF0Y2hlc1dvcmRzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZmlsdGVycy5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSVByZWZlcmVuY2VzU2VhcmNoU2VydmljZSwgSVJlbW90ZVNlYXJjaFByb3ZpZGVyLCBJU2VhcmNoUHJvdmlkZXIsIElXb3JrYmVuY2hTZXR0aW5nc0NvbmZpZ3VyYXRpb24gfSBmcm9tICcuLi9jb21tb24vcHJlZmVyZW5jZXMuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLCBJTG9jYWxFeHRlbnNpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9leHRlbnNpb25NYW5hZ2VtZW50L2NvbW1vbi9leHRlbnNpb25NYW5hZ2VtZW50LmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hFeHRlbnNpb25FbmFibGVtZW50U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbk1hbmFnZW1lbnQvY29tbW9uL2V4dGVuc2lvbk1hbmFnZW1lbnQuanMnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW4gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9uVHlwZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJbnN0YW50aWF0aW9uVHlwZSwgcmVnaXN0ZXJTaW5nbGV0b24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IElBaVJlbGF0ZWRJbmZvcm1hdGlvblNlcnZpY2UsIFJlbGF0ZWRJbmZvcm1hdGlvblR5cGUsIFNldHRpbmdJbmZvcm1hdGlvblJlc3VsdCB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2FpUmVsYXRlZEluZm9ybWF0aW9uL2NvbW1vbi9haVJlbGF0ZWRJbmZvcm1hdGlvbi5qcyc7XG5pbXBvcnQgeyBUZklkZkNhbGN1bGF0b3IsIFRmSWRmRG9jdW1lbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90ZklkZi5qcyc7XG5pbXBvcnQgeyBJU3RyaW5nRGljdGlvbmFyeSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvbGxlY3Rpb25zLmpzJztcbmltcG9ydCB7IG51bGxSYW5nZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3ByZWZlcmVuY2VzL2NvbW1vbi9wcmVmZXJlbmNlc01vZGVscy5qcyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUVuZHBvaW50RGV0YWlscyB7XG5cdHVybEJhc2U/OiBzdHJpbmc7XG5cdGtleT86IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIFByZWZlcmVuY2VzU2VhcmNoU2VydmljZSBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJUHJlZmVyZW5jZXNTZWFyY2hTZXJ2aWNlIHtcblx0ZGVjbGFyZSByZWFkb25seSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cblx0Ly8gQHRzLWV4cGVjdC1lcnJvciBkaXNhYmxlIHJlbW90ZSBzZWFyY2ggZm9yIG5vdywgcmVmIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8xNzI0MTFcblx0cHJpdmF0ZSBfaW5zdGFsbGVkRXh0ZW5zaW9uczogUHJvbWlzZTxJTG9jYWxFeHRlbnNpb25bXT47XG5cdHByaXZhdGUgX3JlbW90ZVNlYXJjaFByb3ZpZGVyOiBJUmVtb3RlU2VhcmNoUHJvdmlkZXIgfCB1bmRlZmluZWQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElFeHRlbnNpb25NYW5hZ2VtZW50U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlOiBJRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UsXG5cdFx0QElXb3JrYmVuY2hFeHRlbnNpb25FbmFibGVtZW50U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlOiBJV29ya2JlbmNoRXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdC8vIFRoaXMgcmVxdWVzdCBnb2VzIHRvIHRoZSBzaGFyZWQgcHJvY2VzcyBidXQgcmVzdWx0cyB3b24ndCBjaGFuZ2UgZHVyaW5nIGEgd2luZG93J3MgbGlmZXRpbWUsIHNvIGNhY2hlIHRoZSByZXN1bHRzLlxuXHRcdHRoaXMuX2luc3RhbGxlZEV4dGVuc2lvbnMgPSB0aGlzLmV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLmdldEluc3RhbGxlZChFeHRlbnNpb25UeXBlLlVzZXIpLnRoZW4oZXh0cyA9PiB7XG5cdFx0XHQvLyBGaWx0ZXIgdG8gZW5hYmxlZCBleHRlbnNpb25zIHRoYXQgaGF2ZSBzZXR0aW5nc1xuXHRcdFx0cmV0dXJuIGV4dHNcblx0XHRcdFx0LmZpbHRlcihleHQgPT4gdGhpcy5leHRlbnNpb25FbmFibGVtZW50U2VydmljZS5pc0VuYWJsZWQoZXh0KSlcblx0XHRcdFx0LmZpbHRlcihleHQgPT4gZXh0Lm1hbmlmZXN0ICYmIGV4dC5tYW5pZmVzdC5jb250cmlidXRlcyAmJiBleHQubWFuaWZlc3QuY29udHJpYnV0ZXMuY29uZmlndXJhdGlvbilcblx0XHRcdFx0LmZpbHRlcihleHQgPT4gISFleHQuaWRlbnRpZmllci51dWlkKTtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0IHJlbW90ZVNlYXJjaEFsbG93ZWQoKTogYm9vbGVhbiB7XG5cdFx0Y29uc3Qgd29ya2JlbmNoU2V0dGluZ3MgPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPElXb3JrYmVuY2hTZXR0aW5nc0NvbmZpZ3VyYXRpb24+KCkud29ya2JlbmNoLnNldHRpbmdzO1xuXHRcdHJldHVybiB3b3JrYmVuY2hTZXR0aW5ncy5lbmFibGVOYXR1cmFsTGFuZ3VhZ2VTZWFyY2g7XG5cdH1cblxuXHRnZXRSZW1vdGVTZWFyY2hQcm92aWRlcihmaWx0ZXI6IHN0cmluZyk6IElSZW1vdGVTZWFyY2hQcm92aWRlciB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKCF0aGlzLnJlbW90ZVNlYXJjaEFsbG93ZWQpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0dGhpcy5fcmVtb3RlU2VhcmNoUHJvdmlkZXIgPz89IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoUmVtb3RlU2VhcmNoUHJvdmlkZXIpO1xuXHRcdHRoaXMuX3JlbW90ZVNlYXJjaFByb3ZpZGVyLnNldEZpbHRlcihmaWx0ZXIpO1xuXHRcdHJldHVybiB0aGlzLl9yZW1vdGVTZWFyY2hQcm92aWRlcjtcblx0fVxuXG5cdGdldExvY2FsU2VhcmNoUHJvdmlkZXIoZmlsdGVyOiBzdHJpbmcpOiBMb2NhbFNlYXJjaFByb3ZpZGVyIHtcblx0XHRyZXR1cm4gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShMb2NhbFNlYXJjaFByb3ZpZGVyLCBmaWx0ZXIpO1xuXHR9XG59XG5cbmZ1bmN0aW9uIGNsZWFuRmlsdGVyKGZpbHRlcjogc3RyaW5nKTogc3RyaW5nIHtcblx0Ly8gUmVtb3ZlIFwiIGFuZCA6IHdoaWNoIGFyZSBsaWtlbHkgdG8gYmUgY29weXBhc3RlZCBhcyBwYXJ0IG9mIGEgc2V0dGluZyBuYW1lLlxuXHQvLyBMZWF2ZSBvdGhlciBzcGVjaWFsIGNoYXJhY3RlcnMgd2hpY2ggdGhlIHVzZXIgbWlnaHQgd2FudCB0byBzZWFyY2ggZm9yLlxuXHRyZXR1cm4gZmlsdGVyXG5cdFx0LnJlcGxhY2UoL1tcIjpdL2csICcgJylcblx0XHQucmVwbGFjZSgvICAvZywgJyAnKVxuXHRcdC50cmltKCk7XG59XG5cbmV4cG9ydCBjbGFzcyBMb2NhbFNlYXJjaFByb3ZpZGVyIGltcGxlbWVudHMgSVNlYXJjaFByb3ZpZGVyIHtcblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSBfZmlsdGVyOiBzdHJpbmcsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2Vcblx0KSB7XG5cdFx0dGhpcy5fZmlsdGVyID0gY2xlYW5GaWx0ZXIodGhpcy5fZmlsdGVyKTtcblx0fVxuXG5cdHNlYXJjaE1vZGVsKHByZWZlcmVuY2VzTW9kZWw6IElTZXR0aW5nc0VkaXRvck1vZGVsLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPElTZWFyY2hSZXN1bHQgfCBudWxsPiB7XG5cdFx0aWYgKCF0aGlzLl9maWx0ZXIpIHtcblx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUobnVsbCk7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc2V0dGluZ01hdGNoZXI6IElTZXR0aW5nTWF0Y2hlciA9IChzZXR0aW5nOiBJU2V0dGluZykgPT4ge1xuXHRcdFx0bGV0IHsgbWF0Y2hlcywgbWF0Y2hUeXBlLCBrZXlNYXRjaFNjb3JlIH0gPSBuZXcgU2V0dGluZ01hdGNoZXMoXG5cdFx0XHRcdHRoaXMuX2ZpbHRlcixcblx0XHRcdFx0c2V0dGluZyxcblx0XHRcdFx0dHJ1ZSxcblx0XHRcdFx0dGhpcy5jb25maWd1cmF0aW9uU2VydmljZVxuXHRcdFx0KTtcblx0XHRcdGlmIChtYXRjaFR5cGUgPT09IFNldHRpbmdNYXRjaFR5cGUuTm9uZSB8fCBtYXRjaGVzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdGlmIChzdHJpbmdzLmVxdWFsc0lnbm9yZUNhc2UodGhpcy5fZmlsdGVyLCBzZXR0aW5nLmtleSkpIHtcblx0XHRcdFx0bWF0Y2hUeXBlID0gU2V0dGluZ01hdGNoVHlwZS5FeGFjdE1hdGNoO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0bWF0Y2hlcyxcblx0XHRcdFx0bWF0Y2hUeXBlLFxuXHRcdFx0XHRrZXlNYXRjaFNjb3JlLFxuXHRcdFx0XHRzY29yZTogMCAvLyBvbmx5IHVzZWQgZm9yIFJlbW90ZVNlYXJjaFByb3ZpZGVyIG1hdGNoZXMuXG5cdFx0XHR9O1xuXHRcdH07XG5cblx0XHRjb25zdCBmaWx0ZXJNYXRjaGVzID0gcHJlZmVyZW5jZXNNb2RlbC5maWx0ZXJTZXR0aW5ncyh0aGlzLl9maWx0ZXIsIHRoaXMuZ2V0R3JvdXBGaWx0ZXIodGhpcy5fZmlsdGVyKSwgc2V0dGluZ01hdGNoZXIpO1xuXG5cdFx0Ly8gQ2hlY2sgdGhlIHRvcCBrZXkgbWF0Y2ggdHlwZS5cblx0XHRjb25zdCB0b3BLZXlNYXRjaFR5cGUgPSBNYXRoLm1heCguLi5maWx0ZXJNYXRjaGVzLm1hcChtID0+IChtLm1hdGNoVHlwZSAmIFNldHRpbmdLZXlNYXRjaFR5cGVzKSkpO1xuXHRcdC8vIEFsd2F5cyBhbGxvdyBkZXNjcmlwdGlvbiBtYXRjaGVzIGFzIHBhcnQgb2YgaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzIzOTkzNi5cblx0XHRjb25zdCBhbHdheXNBbGxvd2VkTWF0Y2hUeXBlcyA9IFNldHRpbmdNYXRjaFR5cGUuRGVzY3JpcHRpb25PclZhbHVlTWF0Y2ggfCBTZXR0aW5nTWF0Y2hUeXBlLkxhbmd1YWdlVGFnU2V0dGluZ01hdGNoO1xuXHRcdGNvbnN0IGZpbHRlcmVkTWF0Y2hlcyA9IGZpbHRlck1hdGNoZXMuZmlsdGVyKG0gPT4gKG0ubWF0Y2hUeXBlICYgdG9wS2V5TWF0Y2hUeXBlKSB8fCAobS5tYXRjaFR5cGUgJiBhbHdheXNBbGxvd2VkTWF0Y2hUeXBlcykgfHwgbS5tYXRjaFR5cGUgPT09IFNldHRpbmdNYXRjaFR5cGUuRXhhY3RNYXRjaCk7XG5cdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSh7XG5cdFx0XHRmaWx0ZXJNYXRjaGVzOiBmaWx0ZXJlZE1hdGNoZXMsXG5cdFx0XHRleGFjdE1hdGNoOiBmaWx0ZXJlZE1hdGNoZXMuc29tZShtID0+IG0ubWF0Y2hUeXBlID09PSBTZXR0aW5nTWF0Y2hUeXBlLkV4YWN0TWF0Y2gpXG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIGdldEdyb3VwRmlsdGVyKGZpbHRlcjogc3RyaW5nKTogSUdyb3VwRmlsdGVyIHtcblx0XHRjb25zdCByZWdleCA9IHN0cmluZ3MuY3JlYXRlUmVnRXhwKGZpbHRlciwgZmFsc2UsIHsgZ2xvYmFsOiB0cnVlIH0pO1xuXHRcdHJldHVybiAoZ3JvdXA6IElTZXR0aW5nc0dyb3VwKSA9PiB7XG5cdFx0XHRyZXR1cm4gZ3JvdXAuaWQgIT09ICdkZWZhdWx0T3ZlcnJpZGVzJyAmJiByZWdleC50ZXN0KGdyb3VwLnRpdGxlKTtcblx0XHR9O1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBTZXR0aW5nTWF0Y2hlcyB7XG5cdHJlYWRvbmx5IG1hdGNoZXM6IElSYW5nZVtdO1xuXHRtYXRjaFR5cGU6IFNldHRpbmdNYXRjaFR5cGUgPSBTZXR0aW5nTWF0Y2hUeXBlLk5vbmU7XG5cdC8qKlxuXHQgKiBBIG1hdGNoIHNjb3JlIGZvciBrZXkgbWF0Y2hlcyB0byBhbGxvdyBjb21wYXJpbmcga2V5IG1hdGNoZXMgYWdhaW5zdCBlYWNoIG90aGVyLlxuXHQgKiBPdGhlcndpc2UsIGFsbCBrZXkgbWF0Y2hlcyBhcmUgdHJlYXRlZCB0aGUgc2FtZSwgYW5kIHNvcnRpbmcgaXMgZG9uZSBieSBUb0Mgb3JkZXIuXG5cdCAqL1xuXHRrZXlNYXRjaFNjb3JlOiBudW1iZXIgPSAwO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHNlYXJjaFN0cmluZzogc3RyaW5nLFxuXHRcdHNldHRpbmc6IElTZXR0aW5nLFxuXHRcdHByaXZhdGUgc2VhcmNoRGVzY3JpcHRpb246IGJvb2xlYW4sXG5cdFx0cHJpdmF0ZSByZWFkb25seSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlXG5cdCkge1xuXHRcdHRoaXMubWF0Y2hlcyA9IGRpc3RpbmN0KHRoaXMuX2ZpbmRNYXRjaGVzSW5TZXR0aW5nKHNlYXJjaFN0cmluZywgc2V0dGluZyksIChtYXRjaCkgPT4gYCR7bWF0Y2guc3RhcnRMaW5lTnVtYmVyfV8ke21hdGNoLnN0YXJ0Q29sdW1ufV8ke21hdGNoLmVuZExpbmVOdW1iZXJ9XyR7bWF0Y2guZW5kQ29sdW1ufV9gKTtcblx0fVxuXG5cdHByaXZhdGUgX2ZpbmRNYXRjaGVzSW5TZXR0aW5nKHNlYXJjaFN0cmluZzogc3RyaW5nLCBzZXR0aW5nOiBJU2V0dGluZyk6IElSYW5nZVtdIHtcblx0XHRjb25zdCByZXN1bHQgPSB0aGlzLl9kb0ZpbmRNYXRjaGVzSW5TZXR0aW5nKHNlYXJjaFN0cmluZywgc2V0dGluZyk7XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdHByaXZhdGUgX2tleVRvTGFiZWwoc2V0dGluZ0lkOiBzdHJpbmcpOiBzdHJpbmcge1xuXHRcdGNvbnN0IGxhYmVsID0gc2V0dGluZ0lkXG5cdFx0XHQucmVwbGFjZSgvWy0uX10vZywgJyAnKVxuXHRcdFx0LnJlcGxhY2UoLyhbYS16XSspKFtBLVpdKS9nLCAnJDEgJDInKVxuXHRcdFx0LnJlcGxhY2UoLyhbQS1aYS16XSspKFxcZCspL2csICckMSAkMicpXG5cdFx0XHQucmVwbGFjZSgvKFxcZCspKFtBLVphLXpdKykvZywgJyQxICQyJylcblx0XHRcdC50b0xvd2VyQ2FzZSgpO1xuXHRcdHJldHVybiBsYWJlbDtcblx0fVxuXG5cdHByaXZhdGUgX3RvQWxwaGFOdW1lcmljKHM6IHN0cmluZyk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHMucmVwbGFjZSgvW15BLVphLXowLTldKy9nLCAnJyk7XG5cdH1cblxuXHRwcml2YXRlIF9kb0ZpbmRNYXRjaGVzSW5TZXR0aW5nKHNlYXJjaFN0cmluZzogc3RyaW5nLCBzZXR0aW5nOiBJU2V0dGluZyk6IElSYW5nZVtdIHtcblx0XHRjb25zdCBkZXNjcmlwdGlvbk1hdGNoaW5nV29yZHM6IE1hcDxzdHJpbmcsIElSYW5nZVtdPiA9IG5ldyBNYXA8c3RyaW5nLCBJUmFuZ2VbXT4oKTtcblx0XHRjb25zdCBrZXlNYXRjaGluZ1dvcmRzOiBNYXA8c3RyaW5nLCBJUmFuZ2VbXT4gPSBuZXcgTWFwPHN0cmluZywgSVJhbmdlW10+KCk7XG5cdFx0Y29uc3QgdmFsdWVNYXRjaGluZ1dvcmRzOiBNYXA8c3RyaW5nLCBJUmFuZ2VbXT4gPSBuZXcgTWFwPHN0cmluZywgSVJhbmdlW10+KCk7XG5cblx0XHQvLyBLZXkgKElEKSBzZWFyY2hcblx0XHQvLyBGaXJzdCwgc2VhcmNoIGJ5IHRoZSBzZXR0aW5nJ3MgSUQgYW5kIGxhYmVsLlxuXHRcdGNvbnN0IHNldHRpbmdLZXlBc1dvcmRzOiBzdHJpbmcgPSB0aGlzLl9rZXlUb0xhYmVsKHNldHRpbmcua2V5KTtcblx0XHRjb25zdCBxdWVyeVdvcmRzID0gbmV3IFNldDxzdHJpbmc+KHNlYXJjaFN0cmluZy5zcGxpdCgnICcpKTtcblx0XHRmb3IgKGNvbnN0IHdvcmQgb2YgcXVlcnlXb3Jkcykge1xuXHRcdFx0Ly8gQ2hlY2sgaWYgdGhlIGtleSBjb250YWlucyB0aGUgd29yZC4gVXNlIGNvbnRpZ3VvdXMgc2VhcmNoLlxuXHRcdFx0Y29uc3Qga2V5TWF0Y2hlcyA9IG1hdGNoZXNXb3Jkcyh3b3JkLCBzZXR0aW5nS2V5QXNXb3JkcywgdHJ1ZSk7XG5cdFx0XHRpZiAoa2V5TWF0Y2hlcz8ubGVuZ3RoKSB7XG5cdFx0XHRcdGtleU1hdGNoaW5nV29yZHMuc2V0KHdvcmQsIGtleU1hdGNoZXMubWFwKG1hdGNoID0+IHRoaXMudG9LZXlSYW5nZShzZXR0aW5nLCBtYXRjaCkpKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0aWYgKGtleU1hdGNoaW5nV29yZHMuc2l6ZSA9PT0gcXVlcnlXb3Jkcy5zaXplKSB7XG5cdFx0XHQvLyBBbGwgd29yZHMgaW4gdGhlIHF1ZXJ5IG1hdGNoZWQgd2l0aCBzb21ldGhpbmcgaW4gdGhlIHNldHRpbmcga2V5LlxuXHRcdFx0Ly8gTWF0Y2hlcyBcImVkaXQgZm9ybWF0IG9uIHBhc3RlXCIgdG8gXCJlZGl0b3IuZm9ybWF0T25QYXN0ZVwiLlxuXHRcdFx0dGhpcy5tYXRjaFR5cGUgfD0gU2V0dGluZ01hdGNoVHlwZS5BbGxXb3Jkc0luU2V0dGluZ3NMYWJlbDtcblx0XHR9IGVsc2UgaWYgKGtleU1hdGNoaW5nV29yZHMuc2l6ZSA+PSAyKSB7XG5cdFx0XHQvLyBNYXRjaGVzIFwiZWRpdCBwYXN0ZVwiIHRvIFwiZWRpdG9yLmZvcm1hdE9uUGFzdGVcIi5cblx0XHRcdC8vIFRoZSBpZiBzdGF0ZW1lbnQgcmVkdWNlcyBub2lzZSBieSBwcmV2ZW50aW5nIFwiZWRpdG9yIGZvcm1hdG9ucGFzdFwiIGZyb20gbWF0Y2hpbmcgYWxsIGVkaXRvciBzZXR0aW5ncy5cblx0XHRcdHRoaXMubWF0Y2hUeXBlIHw9IFNldHRpbmdNYXRjaFR5cGUuQ29udGlndW91c1dvcmRzSW5TZXR0aW5nc0xhYmVsO1xuXHRcdFx0dGhpcy5rZXlNYXRjaFNjb3JlID0ga2V5TWF0Y2hpbmdXb3Jkcy5zaXplO1xuXHRcdH1cblx0XHRjb25zdCBzZWFyY2hTdHJpbmdBbHBoYU51bWVyaWMgPSB0aGlzLl90b0FscGhhTnVtZXJpYyhzZWFyY2hTdHJpbmcpO1xuXHRcdGNvbnN0IGtleUFscGhhTnVtZXJpYyA9IHRoaXMuX3RvQWxwaGFOdW1lcmljKHNldHRpbmcua2V5KTtcblx0XHRjb25zdCBrZXlJZE1hdGNoZXMgPSBtYXRjaGVzQ29udGlndW91c1N1YlN0cmluZyhzZWFyY2hTdHJpbmdBbHBoYU51bWVyaWMsIGtleUFscGhhTnVtZXJpYyk7XG5cdFx0aWYgKGtleUlkTWF0Y2hlcz8ubGVuZ3RoKSB7XG5cdFx0XHQvLyBNYXRjaGVzIFwiZWRpdG9yZm9ybWF0b25wXCIgdG8gXCJlZGl0b3IuZm9ybWF0b25wYXN0ZVwiLlxuXHRcdFx0a2V5TWF0Y2hpbmdXb3Jkcy5zZXQoc2V0dGluZy5rZXksIGtleUlkTWF0Y2hlcy5tYXAobWF0Y2ggPT4gdGhpcy50b0tleVJhbmdlKHNldHRpbmcsIG1hdGNoKSkpO1xuXHRcdFx0dGhpcy5tYXRjaFR5cGUgfD0gU2V0dGluZ01hdGNoVHlwZS5Db250aWd1b3VzUXVlcnlJblNldHRpbmdJZDtcblx0XHR9XG5cblx0XHQvLyBGYWxsIGJhY2sgdG8gbm9uLWNvbnRpZ3VvdXMga2V5IChJRCkgc2VhcmNoZXMgaWYgbm90aGluZyBtYXRjaGVkIHlldC5cblx0XHRpZiAodGhpcy5tYXRjaFR5cGUgPT09IFNldHRpbmdNYXRjaFR5cGUuTm9uZSkge1xuXHRcdFx0a2V5TWF0Y2hpbmdXb3Jkcy5jbGVhcigpO1xuXHRcdFx0Zm9yIChjb25zdCB3b3JkIG9mIHF1ZXJ5V29yZHMpIHtcblx0XHRcdFx0Y29uc3Qga2V5TWF0Y2hlcyA9IG1hdGNoZXNXb3Jkcyh3b3JkLCBzZXR0aW5nS2V5QXNXb3JkcywgZmFsc2UpO1xuXHRcdFx0XHRpZiAoa2V5TWF0Y2hlcz8ubGVuZ3RoKSB7XG5cdFx0XHRcdFx0a2V5TWF0Y2hpbmdXb3Jkcy5zZXQod29yZCwga2V5TWF0Y2hlcy5tYXAobWF0Y2ggPT4gdGhpcy50b0tleVJhbmdlKHNldHRpbmcsIG1hdGNoKSkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAoa2V5TWF0Y2hpbmdXb3Jkcy5zaXplID49IDIgfHwgKGtleU1hdGNoaW5nV29yZHMuc2l6ZSA9PT0gMSAmJiBxdWVyeVdvcmRzLnNpemUgPT09IDEpKSB7XG5cdFx0XHRcdC8vIE1hdGNoZXMgXCJlZGZvcm9ucGFzXCIgdG8gXCJlZGl0b3IuZm9ybWF0T25QYXN0ZVwiLlxuXHRcdFx0XHQvLyBUaGUgaWYgc3RhdGVtZW50IHJlZHVjZXMgbm9pc2UgYnkgcHJldmVudGluZyBcImVkaXRvciBmb21vbnBhc3RcIiBmcm9tIG1hdGNoaW5nIGFsbCBlZGl0b3Igc2V0dGluZ3MuXG5cdFx0XHRcdHRoaXMubWF0Y2hUeXBlIHw9IFNldHRpbmdNYXRjaFR5cGUuTm9uQ29udGlndW91c1dvcmRzSW5TZXR0aW5nc0xhYmVsO1xuXHRcdFx0XHR0aGlzLmtleU1hdGNoU2NvcmUgPSBrZXlNYXRjaGluZ1dvcmRzLnNpemU7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjb25zdCBrZXlJZE1hdGNoZXMgPSBtYXRjaGVzU3ViU3RyaW5nKHNlYXJjaFN0cmluZ0FscGhhTnVtZXJpYywga2V5QWxwaGFOdW1lcmljKTtcblx0XHRcdFx0aWYgKGtleUlkTWF0Y2hlcz8ubGVuZ3RoKSB7XG5cdFx0XHRcdFx0Ly8gTWF0Y2hlcyBcImVkZm1vbnBhc1wiIHRvIFwiZWRpdG9yLmZvcm1hdE9uUGFzdGVcIi5cblx0XHRcdFx0XHRrZXlNYXRjaGluZ1dvcmRzLnNldChzZXR0aW5nLmtleSwga2V5SWRNYXRjaGVzLm1hcChtYXRjaCA9PiB0aGlzLnRvS2V5UmFuZ2Uoc2V0dGluZywgbWF0Y2gpKSk7XG5cdFx0XHRcdFx0dGhpcy5tYXRjaFR5cGUgfD0gU2V0dGluZ01hdGNoVHlwZS5Ob25Db250aWd1b3VzUXVlcnlJblNldHRpbmdJZDtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIENoZWNrIGlmIHRoZSBtYXRjaCB3YXMgZm9yIGEgbGFuZ3VhZ2UgdGFnIGdyb3VwIHNldHRpbmcgc3VjaCBhcyBbbWFya2Rvd25dLlxuXHRcdC8vIEluIHN1Y2ggYSBjYXNlLCBtb3ZlIHRoYXQgc2V0dGluZyB0byBiZSBsYXN0LlxuXHRcdGlmIChzZXR0aW5nLm92ZXJyaWRlcz8ubGVuZ3RoICYmICh0aGlzLm1hdGNoVHlwZSAhPT0gU2V0dGluZ01hdGNoVHlwZS5Ob25lKSkge1xuXHRcdFx0dGhpcy5tYXRjaFR5cGUgPSBTZXR0aW5nTWF0Y2hUeXBlLkxhbmd1YWdlVGFnU2V0dGluZ01hdGNoO1xuXHRcdFx0Y29uc3Qga2V5UmFuZ2VzID0ga2V5TWF0Y2hpbmdXb3Jkcy5zaXplID9cblx0XHRcdFx0QXJyYXkuZnJvbShrZXlNYXRjaGluZ1dvcmRzLnZhbHVlcygpKS5mbGF0KCkgOiBbXTtcblx0XHRcdHJldHVybiBbLi4ua2V5UmFuZ2VzXTtcblx0XHR9XG5cblx0XHQvLyBEZXNjcmlwdGlvbiBzZWFyY2hcblx0XHQvLyBTZWFyY2ggdGhlIGRlc2NyaXB0aW9uIGlmIHdlIGZvdW5kIG5vbi1jb250aWd1b3VzIGtleSBtYXRjaGVzIGF0IGJlc3QuXG5cdFx0Y29uc3QgaGFzQ29udGlndW91c0tleU1hdGNoVHlwZXMgPSB0aGlzLm1hdGNoVHlwZSA+PSBTZXR0aW5nTWF0Y2hUeXBlLkNvbnRpZ3VvdXNXb3Jkc0luU2V0dGluZ3NMYWJlbDtcblx0XHRpZiAodGhpcy5zZWFyY2hEZXNjcmlwdGlvbiAmJiAhaGFzQ29udGlndW91c0tleU1hdGNoVHlwZXMpIHtcblx0XHRcdGZvciAoY29uc3Qgd29yZCBvZiBxdWVyeVdvcmRzKSB7XG5cdFx0XHRcdC8vIFNlYXJjaCB0aGUgZGVzY3JpcHRpb24gbGluZXMuXG5cdFx0XHRcdGZvciAobGV0IGxpbmVJbmRleCA9IDA7IGxpbmVJbmRleCA8IHNldHRpbmcuZGVzY3JpcHRpb24ubGVuZ3RoOyBsaW5lSW5kZXgrKykge1xuXHRcdFx0XHRcdGNvbnN0IGRlc2NyaXB0aW9uTWF0Y2hlcyA9IG1hdGNoZXNDb250aWd1b3VzU3ViU3RyaW5nKHdvcmQsIHNldHRpbmcuZGVzY3JpcHRpb25bbGluZUluZGV4XSk7XG5cdFx0XHRcdFx0aWYgKGRlc2NyaXB0aW9uTWF0Y2hlcz8ubGVuZ3RoKSB7XG5cdFx0XHRcdFx0XHRkZXNjcmlwdGlvbk1hdGNoaW5nV29yZHMuc2V0KHdvcmQsIGRlc2NyaXB0aW9uTWF0Y2hlcy5tYXAobWF0Y2ggPT4gdGhpcy50b0Rlc2NyaXB0aW9uUmFuZ2Uoc2V0dGluZywgbWF0Y2gsIGxpbmVJbmRleCkpKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmIChkZXNjcmlwdGlvbk1hdGNoaW5nV29yZHMuc2l6ZSA9PT0gcXVlcnlXb3Jkcy5zaXplKSB7XG5cdFx0XHRcdHRoaXMubWF0Y2hUeXBlIHw9IFNldHRpbmdNYXRjaFR5cGUuRGVzY3JpcHRpb25PclZhbHVlTWF0Y2g7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHQvLyBDbGVhciBvdXQgdGhlIG1hdGNoIGZvciBub3cuIFdlIHdhbnQgdG8gcmVxdWlyZSBhbGwgd29yZHMgdG8gbWF0Y2ggaW4gdGhlIGRlc2NyaXB0aW9uLlxuXHRcdFx0XHRkZXNjcmlwdGlvbk1hdGNoaW5nV29yZHMuY2xlYXIoKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBWYWx1ZSBzZWFyY2hcblx0XHQvLyBDaGVjayBpZiB0aGUgdmFsdWUgY29udGFpbnMgYWxsIHRoZSB3b3Jkcy5cblx0XHQvLyBTZWFyY2ggdGhlIHZhbHVlcyBpZiB3ZSBmb3VuZCBub24tY29udGlndW91cyBrZXkgbWF0Y2hlcyBhdCBiZXN0LlxuXHRcdGlmICghaGFzQ29udGlndW91c0tleU1hdGNoVHlwZXMpIHtcblx0XHRcdGlmIChzZXR0aW5nLmVudW0/Lmxlbmd0aCkge1xuXHRcdFx0XHQvLyBTZWFyY2ggYWxsIHN0cmluZyB2YWx1ZXMgb2YgZW51bXMuXG5cdFx0XHRcdGZvciAoY29uc3Qgb3B0aW9uIG9mIHNldHRpbmcuZW51bSkge1xuXHRcdFx0XHRcdGlmICh0eXBlb2Ygb3B0aW9uICE9PSAnc3RyaW5nJykge1xuXHRcdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHZhbHVlTWF0Y2hpbmdXb3Jkcy5jbGVhcigpO1xuXHRcdFx0XHRcdGZvciAoY29uc3Qgd29yZCBvZiBxdWVyeVdvcmRzKSB7XG5cdFx0XHRcdFx0XHRjb25zdCB2YWx1ZU1hdGNoZXMgPSBtYXRjaGVzQ29udGlndW91c1N1YlN0cmluZyh3b3JkLCBvcHRpb24pO1xuXHRcdFx0XHRcdFx0aWYgKHZhbHVlTWF0Y2hlcz8ubGVuZ3RoKSB7XG5cdFx0XHRcdFx0XHRcdHZhbHVlTWF0Y2hpbmdXb3Jkcy5zZXQod29yZCwgdmFsdWVNYXRjaGVzLm1hcChtYXRjaCA9PiB0aGlzLnRvVmFsdWVSYW5nZShzZXR0aW5nLCBtYXRjaCkpKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKHZhbHVlTWF0Y2hpbmdXb3Jkcy5zaXplID09PSBxdWVyeVdvcmRzLnNpemUpIHtcblx0XHRcdFx0XHRcdHRoaXMubWF0Y2hUeXBlIHw9IFNldHRpbmdNYXRjaFR5cGUuRGVzY3JpcHRpb25PclZhbHVlTWF0Y2g7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0Ly8gQ2xlYXIgb3V0IHRoZSBtYXRjaCBmb3Igbm93LiBXZSB3YW50IHRvIHJlcXVpcmUgYWxsIHdvcmRzIHRvIG1hdGNoIGluIHRoZSB2YWx1ZS5cblx0XHRcdFx0XHRcdHZhbHVlTWF0Y2hpbmdXb3Jkcy5jbGVhcigpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly8gU2VhcmNoIHNpbmdsZSBzdHJpbmcgdmFsdWUuXG5cdFx0XHRcdGNvbnN0IHNldHRpbmdWYWx1ZSA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoc2V0dGluZy5rZXkpO1xuXHRcdFx0XHRpZiAodHlwZW9mIHNldHRpbmdWYWx1ZSA9PT0gJ3N0cmluZycpIHtcblx0XHRcdFx0XHRmb3IgKGNvbnN0IHdvcmQgb2YgcXVlcnlXb3Jkcykge1xuXHRcdFx0XHRcdFx0Y29uc3QgdmFsdWVNYXRjaGVzID0gbWF0Y2hlc0NvbnRpZ3VvdXNTdWJTdHJpbmcod29yZCwgc2V0dGluZ1ZhbHVlKTtcblx0XHRcdFx0XHRcdGlmICh2YWx1ZU1hdGNoZXM/Lmxlbmd0aCkge1xuXHRcdFx0XHRcdFx0XHR2YWx1ZU1hdGNoaW5nV29yZHMuc2V0KHdvcmQsIHZhbHVlTWF0Y2hlcy5tYXAobWF0Y2ggPT4gdGhpcy50b1ZhbHVlUmFuZ2Uoc2V0dGluZywgbWF0Y2gpKSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmICh2YWx1ZU1hdGNoaW5nV29yZHMuc2l6ZSA9PT0gcXVlcnlXb3Jkcy5zaXplKSB7XG5cdFx0XHRcdFx0XHR0aGlzLm1hdGNoVHlwZSB8PSBTZXR0aW5nTWF0Y2hUeXBlLkRlc2NyaXB0aW9uT3JWYWx1ZU1hdGNoO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHQvLyBDbGVhciBvdXQgdGhlIG1hdGNoIGZvciBub3cuIFdlIHdhbnQgdG8gcmVxdWlyZSBhbGwgd29yZHMgdG8gbWF0Y2ggaW4gdGhlIHZhbHVlLlxuXHRcdFx0XHRcdFx0dmFsdWVNYXRjaGluZ1dvcmRzLmNsZWFyKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3QgZGVzY3JpcHRpb25SYW5nZXMgPSBkZXNjcmlwdGlvbk1hdGNoaW5nV29yZHMuc2l6ZSA/XG5cdFx0XHRBcnJheS5mcm9tKGRlc2NyaXB0aW9uTWF0Y2hpbmdXb3Jkcy52YWx1ZXMoKSkuZmxhdCgpIDogW107XG5cdFx0Y29uc3Qga2V5UmFuZ2VzID0ga2V5TWF0Y2hpbmdXb3Jkcy5zaXplID9cblx0XHRcdEFycmF5LmZyb20oa2V5TWF0Y2hpbmdXb3Jkcy52YWx1ZXMoKSkuZmxhdCgpIDogW107XG5cdFx0Y29uc3QgdmFsdWVSYW5nZXMgPSB2YWx1ZU1hdGNoaW5nV29yZHMuc2l6ZSA/XG5cdFx0XHRBcnJheS5mcm9tKHZhbHVlTWF0Y2hpbmdXb3Jkcy52YWx1ZXMoKSkuZmxhdCgpIDogW107XG5cdFx0cmV0dXJuIFsuLi5kZXNjcmlwdGlvblJhbmdlcywgLi4ua2V5UmFuZ2VzLCAuLi52YWx1ZVJhbmdlc107XG5cdH1cblxuXHRwcml2YXRlIHRvS2V5UmFuZ2Uoc2V0dGluZzogSVNldHRpbmcsIG1hdGNoOiBJTWF0Y2gpOiBJUmFuZ2Uge1xuXHRcdHJldHVybiB7XG5cdFx0XHRzdGFydExpbmVOdW1iZXI6IHNldHRpbmcua2V5UmFuZ2Uuc3RhcnRMaW5lTnVtYmVyLFxuXHRcdFx0c3RhcnRDb2x1bW46IHNldHRpbmcua2V5UmFuZ2Uuc3RhcnRDb2x1bW4gKyBtYXRjaC5zdGFydCxcblx0XHRcdGVuZExpbmVOdW1iZXI6IHNldHRpbmcua2V5UmFuZ2Uuc3RhcnRMaW5lTnVtYmVyLFxuXHRcdFx0ZW5kQ29sdW1uOiBzZXR0aW5nLmtleVJhbmdlLnN0YXJ0Q29sdW1uICsgbWF0Y2guZW5kXG5cdFx0fTtcblx0fVxuXG5cdHByaXZhdGUgdG9EZXNjcmlwdGlvblJhbmdlKHNldHRpbmc6IElTZXR0aW5nLCBtYXRjaDogSU1hdGNoLCBsaW5lSW5kZXg6IG51bWJlcik6IElSYW5nZSB7XG5cdFx0Y29uc3QgZGVzY3JpcHRpb25SYW5nZSA9IHNldHRpbmcuZGVzY3JpcHRpb25SYW5nZXNbbGluZUluZGV4XTtcblx0XHRpZiAoIWRlc2NyaXB0aW9uUmFuZ2UpIHtcblx0XHRcdC8vIFRoaXMgY2FzZSBvY2N1cnMgd2l0aCBhZGRlZCBzZXR0aW5ncyBzdWNoIGFzIHRoZVxuXHRcdFx0Ly8gbWFuYWdlIGV4dGVuc2lvbiBzZXR0aW5nLlxuXHRcdFx0cmV0dXJuIG51bGxSYW5nZTtcblx0XHR9XG5cdFx0cmV0dXJuIHtcblx0XHRcdHN0YXJ0TGluZU51bWJlcjogZGVzY3JpcHRpb25SYW5nZS5zdGFydExpbmVOdW1iZXIsXG5cdFx0XHRzdGFydENvbHVtbjogZGVzY3JpcHRpb25SYW5nZS5zdGFydENvbHVtbiArIG1hdGNoLnN0YXJ0LFxuXHRcdFx0ZW5kTGluZU51bWJlcjogZGVzY3JpcHRpb25SYW5nZS5lbmRMaW5lTnVtYmVyLFxuXHRcdFx0ZW5kQ29sdW1uOiBkZXNjcmlwdGlvblJhbmdlLnN0YXJ0Q29sdW1uICsgbWF0Y2guZW5kXG5cdFx0fTtcblx0fVxuXG5cdHByaXZhdGUgdG9WYWx1ZVJhbmdlKHNldHRpbmc6IElTZXR0aW5nLCBtYXRjaDogSU1hdGNoKTogSVJhbmdlIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0c3RhcnRMaW5lTnVtYmVyOiBzZXR0aW5nLnZhbHVlUmFuZ2Uuc3RhcnRMaW5lTnVtYmVyLFxuXHRcdFx0c3RhcnRDb2x1bW46IHNldHRpbmcudmFsdWVSYW5nZS5zdGFydENvbHVtbiArIG1hdGNoLnN0YXJ0ICsgMSxcblx0XHRcdGVuZExpbmVOdW1iZXI6IHNldHRpbmcudmFsdWVSYW5nZS5zdGFydExpbmVOdW1iZXIsXG5cdFx0XHRlbmRDb2x1bW46IHNldHRpbmcudmFsdWVSYW5nZS5zdGFydENvbHVtbiArIG1hdGNoLmVuZCArIDFcblx0XHR9O1xuXHR9XG59XG5cbmNsYXNzIEFpUmVsYXRlZEluZm9ybWF0aW9uU2VhcmNoS2V5c1Byb3ZpZGVyIHtcblx0cHJpdmF0ZSBzZXR0aW5nS2V5czogc3RyaW5nW10gPSBbXTtcblx0cHJpdmF0ZSBzZXR0aW5nc1JlY29yZDogSVN0cmluZ0RpY3Rpb25hcnk8SVNldHRpbmc+ID0ge307XG5cdHByaXZhdGUgY3VycmVudFByZWZlcmVuY2VzTW9kZWw6IElTZXR0aW5nc0VkaXRvck1vZGVsIHwgdW5kZWZpbmVkO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgYWlSZWxhdGVkSW5mb3JtYXRpb25TZXJ2aWNlOiBJQWlSZWxhdGVkSW5mb3JtYXRpb25TZXJ2aWNlXG5cdCkgeyB9XG5cblx0dXBkYXRlTW9kZWwocHJlZmVyZW5jZXNNb2RlbDogSVNldHRpbmdzRWRpdG9yTW9kZWwpIHtcblx0XHRpZiAocHJlZmVyZW5jZXNNb2RlbCA9PT0gdGhpcy5jdXJyZW50UHJlZmVyZW5jZXNNb2RlbCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuY3VycmVudFByZWZlcmVuY2VzTW9kZWwgPSBwcmVmZXJlbmNlc01vZGVsO1xuXHRcdHRoaXMucmVmcmVzaCgpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWZyZXNoKCkge1xuXHRcdHRoaXMuc2V0dGluZ0tleXMgPSBbXTtcblx0XHR0aGlzLnNldHRpbmdzUmVjb3JkID0ge307XG5cblx0XHRpZiAoXG5cdFx0XHQhdGhpcy5jdXJyZW50UHJlZmVyZW5jZXNNb2RlbCB8fFxuXHRcdFx0IXRoaXMuYWlSZWxhdGVkSW5mb3JtYXRpb25TZXJ2aWNlLmlzRW5hYmxlZCgpXG5cdFx0KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Zm9yIChjb25zdCBncm91cCBvZiB0aGlzLmN1cnJlbnRQcmVmZXJlbmNlc01vZGVsLnNldHRpbmdzR3JvdXBzKSB7XG5cdFx0XHRpZiAoZ3JvdXAuaWQgPT09ICdtb3N0Q29tbW9ubHlVc2VkJykge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblx0XHRcdGZvciAoY29uc3Qgc2VjdGlvbiBvZiBncm91cC5zZWN0aW9ucykge1xuXHRcdFx0XHRmb3IgKGNvbnN0IHNldHRpbmcgb2Ygc2VjdGlvbi5zZXR0aW5ncykge1xuXHRcdFx0XHRcdHRoaXMuc2V0dGluZ0tleXMucHVzaChzZXR0aW5nLmtleSk7XG5cdFx0XHRcdFx0dGhpcy5zZXR0aW5nc1JlY29yZFtzZXR0aW5nLmtleV0gPSBzZXR0aW5nO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0Z2V0U2V0dGluZ0tleXMoKTogc3RyaW5nW10ge1xuXHRcdHJldHVybiB0aGlzLnNldHRpbmdLZXlzO1xuXHR9XG5cblx0Z2V0U2V0dGluZ3NSZWNvcmQoKTogSVN0cmluZ0RpY3Rpb25hcnk8SVNldHRpbmc+IHtcblx0XHRyZXR1cm4gdGhpcy5zZXR0aW5nc1JlY29yZDtcblx0fVxufVxuXG5jbGFzcyBBaVJlbGF0ZWRJbmZvcm1hdGlvblNlYXJjaFByb3ZpZGVyIGltcGxlbWVudHMgSVJlbW90ZVNlYXJjaFByb3ZpZGVyIHtcblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgQUlfUkVMQVRFRF9JTkZPUk1BVElPTl9NQVhfUElDS1MgPSA1O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2tleXNQcm92aWRlcjogQWlSZWxhdGVkSW5mb3JtYXRpb25TZWFyY2hLZXlzUHJvdmlkZXI7XG5cdHByaXZhdGUgX2ZpbHRlcjogc3RyaW5nID0gJyc7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElBaVJlbGF0ZWRJbmZvcm1hdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBhaVJlbGF0ZWRJbmZvcm1hdGlvblNlcnZpY2U6IElBaVJlbGF0ZWRJbmZvcm1hdGlvblNlcnZpY2Vcblx0KSB7XG5cdFx0dGhpcy5fa2V5c1Byb3ZpZGVyID0gbmV3IEFpUmVsYXRlZEluZm9ybWF0aW9uU2VhcmNoS2V5c1Byb3ZpZGVyKGFpUmVsYXRlZEluZm9ybWF0aW9uU2VydmljZSk7XG5cdH1cblxuXHRzZXRGaWx0ZXIoZmlsdGVyOiBzdHJpbmcpIHtcblx0XHR0aGlzLl9maWx0ZXIgPSBjbGVhbkZpbHRlcihmaWx0ZXIpO1xuXHR9XG5cblx0YXN5bmMgc2VhcmNoTW9kZWwocHJlZmVyZW5jZXNNb2RlbDogSVNldHRpbmdzRWRpdG9yTW9kZWwsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8SVNlYXJjaFJlc3VsdCB8IG51bGw+IHtcblx0XHRpZiAoXG5cdFx0XHQhdGhpcy5fZmlsdGVyIHx8XG5cdFx0XHQhdGhpcy5haVJlbGF0ZWRJbmZvcm1hdGlvblNlcnZpY2UuaXNFbmFibGVkKClcblx0XHQpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdHRoaXMuX2tleXNQcm92aWRlci51cGRhdGVNb2RlbChwcmVmZXJlbmNlc01vZGVsKTtcblxuXHRcdHJldHVybiB7XG5cdFx0XHRmaWx0ZXJNYXRjaGVzOiBhd2FpdCB0aGlzLmdldEFpUmVsYXRlZEluZm9ybWF0aW9uSXRlbXModG9rZW4pLFxuXHRcdFx0ZXhhY3RNYXRjaDogZmFsc2Vcblx0XHR9O1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBnZXRBaVJlbGF0ZWRJbmZvcm1hdGlvbkl0ZW1zKHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbikge1xuXHRcdGNvbnN0IHNldHRpbmdzUmVjb3JkID0gdGhpcy5fa2V5c1Byb3ZpZGVyLmdldFNldHRpbmdzUmVjb3JkKCk7XG5cblx0XHRjb25zdCBmaWx0ZXJNYXRjaGVzOiBJU2V0dGluZ01hdGNoW10gPSBbXTtcblx0XHRjb25zdCByZWxhdGVkSW5mb3JtYXRpb24gPSBhd2FpdCB0aGlzLmFpUmVsYXRlZEluZm9ybWF0aW9uU2VydmljZS5nZXRSZWxhdGVkSW5mb3JtYXRpb24oXG5cdFx0XHR0aGlzLl9maWx0ZXIsXG5cdFx0XHRbUmVsYXRlZEluZm9ybWF0aW9uVHlwZS5TZXR0aW5nSW5mb3JtYXRpb25dLFxuXHRcdFx0dG9rZW5cblx0XHQpIGFzIFNldHRpbmdJbmZvcm1hdGlvblJlc3VsdFtdO1xuXHRcdHJlbGF0ZWRJbmZvcm1hdGlvbi5zb3J0KChhLCBiKSA9PiBiLndlaWdodCAtIGEud2VpZ2h0KTtcblxuXHRcdGZvciAoY29uc3QgaW5mbyBvZiByZWxhdGVkSW5mb3JtYXRpb24pIHtcblx0XHRcdGlmIChmaWx0ZXJNYXRjaGVzLmxlbmd0aCA9PT0gQWlSZWxhdGVkSW5mb3JtYXRpb25TZWFyY2hQcm92aWRlci5BSV9SRUxBVEVEX0lORk9STUFUSU9OX01BWF9QSUNLUykge1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHRcdGNvbnN0IHBpY2sgPSBpbmZvLnNldHRpbmc7XG5cdFx0XHRmaWx0ZXJNYXRjaGVzLnB1c2goe1xuXHRcdFx0XHRzZXR0aW5nOiBzZXR0aW5nc1JlY29yZFtwaWNrXSxcblx0XHRcdFx0bWF0Y2hlczogW3NldHRpbmdzUmVjb3JkW3BpY2tdLnJhbmdlXSxcblx0XHRcdFx0bWF0Y2hUeXBlOiBTZXR0aW5nTWF0Y2hUeXBlLlJlbW90ZU1hdGNoLFxuXHRcdFx0XHRrZXlNYXRjaFNjb3JlOiAwLFxuXHRcdFx0XHRzY29yZTogaW5mby53ZWlnaHRcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdHJldHVybiBmaWx0ZXJNYXRjaGVzO1xuXHR9XG59XG5cbmNsYXNzIFRmSWRmU2VhcmNoUHJvdmlkZXIgaW1wbGVtZW50cyBJUmVtb3RlU2VhcmNoUHJvdmlkZXIge1xuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBURl9JREZfUFJFX05PUk1BTElaRV9USFJFU0hPTEQgPSA1MDtcblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgVEZfSURGX1BPU1RfTk9STUFMSVpFX1RIUkVTSE9MRCA9IDAuNztcblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgVEZfSURGX01BWF9QSUNLUyA9IDU7XG5cblx0cHJpdmF0ZSBfY3VycmVudFByZWZlcmVuY2VzTW9kZWw6IElTZXR0aW5nc0VkaXRvck1vZGVsIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIF9maWx0ZXI6IHN0cmluZyA9ICcnO1xuXHRwcml2YXRlIF9kb2N1bWVudHM6IFRmSWRmRG9jdW1lbnRbXSA9IFtdO1xuXHRwcml2YXRlIF9zZXR0aW5nc1JlY29yZDogSVN0cmluZ0RpY3Rpb25hcnk8SVNldHRpbmc+ID0ge307XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdH1cblxuXHRzZXRGaWx0ZXIoZmlsdGVyOiBzdHJpbmcpIHtcblx0XHR0aGlzLl9maWx0ZXIgPSBjbGVhbkZpbHRlcihmaWx0ZXIpO1xuXHR9XG5cblx0a2V5VG9MYWJlbChzZXR0aW5nSWQ6IHN0cmluZyk6IHN0cmluZyB7XG5cdFx0Y29uc3QgbGFiZWwgPSBzZXR0aW5nSWRcblx0XHRcdC5yZXBsYWNlKC9bLS5fXS9nLCAnICcpXG5cdFx0XHQucmVwbGFjZSgvKFthLXpdKykoW0EtWl0pL2csICckMSAkMicpXG5cdFx0XHQucmVwbGFjZSgvKFtBLVphLXpdKykoXFxkKykvZywgJyQxICQyJylcblx0XHRcdC5yZXBsYWNlKC8oXFxkKykoW0EtWmEtel0rKS9nLCAnJDEgJDInKVxuXHRcdFx0LnRvTG93ZXJDYXNlKCk7XG5cdFx0cmV0dXJuIGxhYmVsO1xuXHR9XG5cblx0c2V0dGluZ0l0ZW1Ub0VtYmVkZGluZ1N0cmluZyhpdGVtOiBJU2V0dGluZyk6IHN0cmluZyB7XG5cdFx0bGV0IHJlc3VsdCA9IGBTZXR0aW5nIElkOiAke2l0ZW0ua2V5fVxcbmA7XG5cdFx0cmVzdWx0ICs9IGBMYWJlbDogJHt0aGlzLmtleVRvTGFiZWwoaXRlbS5rZXkpfVxcbmA7XG5cdFx0cmVzdWx0ICs9IGBEZXNjcmlwdGlvbjogJHtpdGVtLmRlc2NyaXB0aW9ufVxcbmA7XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdGFzeW5jIHNlYXJjaE1vZGVsKHByZWZlcmVuY2VzTW9kZWw6IElTZXR0aW5nc0VkaXRvck1vZGVsLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPElTZWFyY2hSZXN1bHQgfCBudWxsPiB7XG5cdFx0aWYgKCF0aGlzLl9maWx0ZXIpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLl9jdXJyZW50UHJlZmVyZW5jZXNNb2RlbCAhPT0gcHJlZmVyZW5jZXNNb2RlbCkge1xuXHRcdFx0Ly8gUmVmcmVzaCB0aGUgZG9jdW1lbnRzIGFuZCBzZXR0aW5ncyByZWNvcmRcblx0XHRcdHRoaXMuX2N1cnJlbnRQcmVmZXJlbmNlc01vZGVsID0gcHJlZmVyZW5jZXNNb2RlbDtcblx0XHRcdHRoaXMuX2RvY3VtZW50cyA9IFtdO1xuXHRcdFx0dGhpcy5fc2V0dGluZ3NSZWNvcmQgPSB7fTtcblx0XHRcdGZvciAoY29uc3QgZ3JvdXAgb2YgcHJlZmVyZW5jZXNNb2RlbC5zZXR0aW5nc0dyb3Vwcykge1xuXHRcdFx0XHRpZiAoZ3JvdXAuaWQgPT09ICdtb3N0Q29tbW9ubHlVc2VkJykge1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGZvciAoY29uc3Qgc2VjdGlvbiBvZiBncm91cC5zZWN0aW9ucykge1xuXHRcdFx0XHRcdGZvciAoY29uc3Qgc2V0dGluZyBvZiBzZWN0aW9uLnNldHRpbmdzKSB7XG5cdFx0XHRcdFx0XHR0aGlzLl9kb2N1bWVudHMucHVzaCh7XG5cdFx0XHRcdFx0XHRcdGtleTogc2V0dGluZy5rZXksXG5cdFx0XHRcdFx0XHRcdHRleHRDaHVua3M6IFt0aGlzLnNldHRpbmdJdGVtVG9FbWJlZGRpbmdTdHJpbmcoc2V0dGluZyldXG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdHRoaXMuX3NldHRpbmdzUmVjb3JkW3NldHRpbmcua2V5XSA9IHNldHRpbmc7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHtcblx0XHRcdGZpbHRlck1hdGNoZXM6IGF3YWl0IHRoaXMuZ2V0VGZJZGZJdGVtcyh0b2tlbiksXG5cdFx0XHRleGFjdE1hdGNoOiBmYWxzZVxuXHRcdH07XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGdldFRmSWRmSXRlbXModG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxJU2V0dGluZ01hdGNoW10+IHtcblx0XHRjb25zdCBmaWx0ZXJNYXRjaGVzOiBJU2V0dGluZ01hdGNoW10gPSBbXTtcblx0XHRjb25zdCB0ZklkZkNhbGN1bGF0b3IgPSBuZXcgVGZJZGZDYWxjdWxhdG9yKCk7XG5cdFx0dGZJZGZDYWxjdWxhdG9yLnVwZGF0ZURvY3VtZW50cyh0aGlzLl9kb2N1bWVudHMpO1xuXHRcdGNvbnN0IHRmSWRmUmFua2luZ3MgPSB0ZklkZkNhbGN1bGF0b3IuY2FsY3VsYXRlU2NvcmVzKHRoaXMuX2ZpbHRlciwgdG9rZW4pO1xuXHRcdHRmSWRmUmFua2luZ3Muc29ydCgoYSwgYikgPT4gYi5zY29yZSAtIGEuc2NvcmUpO1xuXHRcdGNvbnN0IG1heFNjb3JlID0gdGZJZGZSYW5raW5nc1swXS5zY29yZTtcblxuXHRcdGlmIChtYXhTY29yZSA8IFRmSWRmU2VhcmNoUHJvdmlkZXIuVEZfSURGX1BSRV9OT1JNQUxJWkVfVEhSRVNIT0xEKSB7XG5cdFx0XHQvLyBSZWplY3QgYWxsIHRoZSBtYXRjaGVzLlxuXHRcdFx0cmV0dXJuIFtdO1xuXHRcdH1cblxuXHRcdGZvciAoY29uc3QgaW5mbyBvZiB0ZklkZlJhbmtpbmdzKSB7XG5cdFx0XHRpZiAoaW5mby5zY29yZSAvIG1heFNjb3JlIDwgVGZJZGZTZWFyY2hQcm92aWRlci5URl9JREZfUE9TVF9OT1JNQUxJWkVfVEhSRVNIT0xEIHx8IGZpbHRlck1hdGNoZXMubGVuZ3RoID09PSBUZklkZlNlYXJjaFByb3ZpZGVyLlRGX0lERl9NQVhfUElDS1MpIHtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBwaWNrID0gaW5mby5rZXk7XG5cdFx0XHRmaWx0ZXJNYXRjaGVzLnB1c2goe1xuXHRcdFx0XHRzZXR0aW5nOiB0aGlzLl9zZXR0aW5nc1JlY29yZFtwaWNrXSxcblx0XHRcdFx0bWF0Y2hlczogW3RoaXMuX3NldHRpbmdzUmVjb3JkW3BpY2tdLnJhbmdlXSxcblx0XHRcdFx0bWF0Y2hUeXBlOiBTZXR0aW5nTWF0Y2hUeXBlLlJlbW90ZU1hdGNoLFxuXHRcdFx0XHRrZXlNYXRjaFNjb3JlOiAwLFxuXHRcdFx0XHRzY29yZTogaW5mby5zY29yZVxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGZpbHRlck1hdGNoZXM7XG5cdH1cbn1cblxuY2xhc3MgUmVtb3RlU2VhcmNoUHJvdmlkZXIgaW1wbGVtZW50cyBJUmVtb3RlU2VhcmNoUHJvdmlkZXIge1xuXHRwcml2YXRlIGFkYVNlYXJjaFByb3ZpZGVyOiBBaVJlbGF0ZWRJbmZvcm1hdGlvblNlYXJjaFByb3ZpZGVyIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIHRmSWRmU2VhcmNoUHJvdmlkZXI6IFRmSWRmU2VhcmNoUHJvdmlkZXIgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgZmlsdGVyOiBzdHJpbmcgPSAnJztcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUFpUmVsYXRlZEluZm9ybWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGFpUmVsYXRlZEluZm9ybWF0aW9uU2VydmljZTogSUFpUmVsYXRlZEluZm9ybWF0aW9uU2VydmljZVxuXHQpIHtcblx0fVxuXG5cdHByaXZhdGUgaW5pdGlhbGl6ZVNlYXJjaFByb3ZpZGVycygpIHtcblx0XHRpZiAodGhpcy5haVJlbGF0ZWRJbmZvcm1hdGlvblNlcnZpY2UuaXNFbmFibGVkKCkpIHtcblx0XHRcdHRoaXMuYWRhU2VhcmNoUHJvdmlkZXIgPz89IG5ldyBBaVJlbGF0ZWRJbmZvcm1hdGlvblNlYXJjaFByb3ZpZGVyKHRoaXMuYWlSZWxhdGVkSW5mb3JtYXRpb25TZXJ2aWNlKTtcblx0XHR9XG5cdFx0dGhpcy50ZklkZlNlYXJjaFByb3ZpZGVyID8/PSBuZXcgVGZJZGZTZWFyY2hQcm92aWRlcigpO1xuXHR9XG5cblx0c2V0RmlsdGVyKGZpbHRlcjogc3RyaW5nKTogdm9pZCB7XG5cdFx0dGhpcy5pbml0aWFsaXplU2VhcmNoUHJvdmlkZXJzKCk7XG5cdFx0dGhpcy5maWx0ZXIgPSBmaWx0ZXI7XG5cdFx0aWYgKHRoaXMuYWRhU2VhcmNoUHJvdmlkZXIpIHtcblx0XHRcdHRoaXMuYWRhU2VhcmNoUHJvdmlkZXIuc2V0RmlsdGVyKGZpbHRlcik7XG5cdFx0fVxuXHRcdHRoaXMudGZJZGZTZWFyY2hQcm92aWRlciEuc2V0RmlsdGVyKGZpbHRlcik7XG5cdH1cblxuXHRhc3luYyBzZWFyY2hNb2RlbChwcmVmZXJlbmNlc01vZGVsOiBJU2V0dGluZ3NFZGl0b3JNb2RlbCwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxJU2VhcmNoUmVzdWx0IHwgbnVsbD4ge1xuXHRcdGlmICghdGhpcy5maWx0ZXIpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdGlmICghdGhpcy5hZGFTZWFyY2hQcm92aWRlcikge1xuXHRcdFx0cmV0dXJuIHRoaXMudGZJZGZTZWFyY2hQcm92aWRlciEuc2VhcmNoTW9kZWwocHJlZmVyZW5jZXNNb2RlbCwgdG9rZW4pO1xuXHRcdH1cblxuXHRcdC8vIFVzZSBURi1JREYgc2VhcmNoIGFzIGEgZmFsbGJhY2ssIHJlZiBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMjI0OTQ2XG5cdFx0bGV0IHJlc3VsdHMgPSBhd2FpdCB0aGlzLmFkYVNlYXJjaFByb3ZpZGVyLnNlYXJjaE1vZGVsKHByZWZlcmVuY2VzTW9kZWwsIHRva2VuKTtcblx0XHRpZiAocmVzdWx0cz8uZmlsdGVyTWF0Y2hlcy5sZW5ndGgpIHtcblx0XHRcdHJldHVybiByZXN1bHRzO1xuXHRcdH1cblx0XHRpZiAoIXRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRyZXN1bHRzID0gYXdhaXQgdGhpcy50ZklkZlNlYXJjaFByb3ZpZGVyIS5zZWFyY2hNb2RlbChwcmVmZXJlbmNlc01vZGVsLCB0b2tlbik7XG5cdFx0XHRpZiAocmVzdWx0cz8uZmlsdGVyTWF0Y2hlcy5sZW5ndGgpIHtcblx0XHRcdFx0cmV0dXJuIHJlc3VsdHM7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBudWxsO1xuXHR9XG59XG5cbnJlZ2lzdGVyU2luZ2xldG9uKElQcmVmZXJlbmNlc1NlYXJjaFNlcnZpY2UsIFByZWZlcmVuY2VzU2VhcmNoU2VydmljZSwgSW5zdGFudGlhdGlvblR5cGUuRGVsYXllZCk7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQXNGLGtCQUFpQyw0QkFBNkM7QUFFcEssU0FBUyxnQkFBZ0I7QUFDekIsWUFBWSxhQUFhO0FBQ3pCLFNBQWlCLDRCQUE0Qixr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
