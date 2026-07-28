/*!
 *
 * (Copyright (c) 2016 Siemens AG
 *
 * Creator: Betz AG 2015
 *
 * Lib: Base External Interface
 * e.g SWAC
 *
 */

/*global framework*/

function externalNavigateByMappingId(publishName, mapId, guiLanguage, applicationIdentifier) {
    /// <summary>
    /// Navigate to Topic or Structure by mappingId
    /// </summary>
    /// <param name="publishName">
    /// Hier wird der PublikationsName übergeben
    /// BEI DCS+:
    /// - de-DE = s7jal81a
    /// - en-US = s7jal81b
    /// </param>
    /// <param name="applicationIdentifier" type="string">applicationIdentifier (e.g. DCS+)</param>
    /// <param name="mapId">e.g. </param>
    /// <param name="guiLanguage">z.B. de-DE,en-US</param>
    /* example
        framework.SetApplicationIdentifier(applicationIdentifier);
    */
    framework.mapping.NavigateByPublishNameAndMapId(publishName, mapId, guiLanguage);
}
function externalNavigateByHtmlFileName(htmlFileName, guiLanguage, applicationIdentifier) {
    /// <summary>
    /// Navigate to Topic or Structure by mappingId
    /// </summary>
    /// <param name="applicationIdentifier" type="string">applicationIdentifier (e.g. DCS+)</param>
    /// <param name="htmlFileName">
    /// Hier wird der HtmlFielname des Topics übergeben
    /// </param>
    /// <param name="guiLanguage">z.B. de-DE,en-US</param>
    /* example
        framework.SetApplicationIdentifier(applicationIdentifier);
    */
    framework.mapping.NavigateByHtmlFileName(htmlFileName, guiLanguage);
}
function externalNavigateByTreeId(treeId, detailTarget, guiLanguage, applicationIdentifier) {
    /// <summary>
    /// Navigate to Topic or Structure by treeId
    /// Wichtig:  !!die treeId ist eine interne Id, welche sich mit einer anderen Version ändert bei gleichem Dokument
    /// </summary>
    /// <param name="applicationIdentifier" type="string">applicationIdentifier (e.g. DCS+)</param>
    /// <param name="treeId">
    /// Hier wird die treeId des Topics/structure übergeben
    /// </param>
    /// <param name="detailTarget">z.B. ein Anker das er hinscrollt</param>
    /// <param name="guiLanguage">z.B. de-DE,en-US</param>
    /* example
        framework.SetApplicationIdentifier(applicationIdentifier);
    */
    framework.mapping.NavigateByTreeId(treeId, detailTarget, guiLanguage);
}
function externalSwitchDataLanguageTo(language, applicationIdentifier) {
    /// <summary>
    /// Switch to gui-language
    /// </summary>
    /// <param name="language">e.g. de-DE, en-US</param>
    framework.language.ChangeDataLanguage(language);
}
function externalSwitchGuiLanguageTo(language, applicationIdentifier) {
    /// <summary>
    /// Switch to gui-language
    /// </summary>
    /// <param name="language">e.g. de-DE, en-US</param>
    framework.language.ChangeGuiLanguage(language);
}
function externalSwitchTheme(theme, applicationIdentifier) {
    /// <summary>
    /// Switch the theme to
    /// </summary>
    /// <param name="theme">e.g. dark,light</param>
    //Future SetTheme(theme);
}
function externalHideHeader(state, applicationIdentifier) {
    /// <summary>
    /// Hide Header
    /// </summary>
    /// <param name="applicationIdentifier" type="string">applicationIdentifier (e.g. DCS+)</param>
    /// <param name="state" type="bool">true or false</param>
    framework.HideHeader(state, applicationIdentifier);
}
function externalHideFooter(state, applicationIdentifier) {
    /// <summary>
    /// Hide Footer
    /// </summary>
    /// <param name="applicationIdentifier" type="string">applicationIdentifier (e.g. DCS+)</param>
    /// <param name="state" type="bool">true or false</param>
    framework.HideFooter(state, applicationIdentifier);
}
function externalSetApplicationIdentifier(applicationIdentifier){
    /// <summary>
    /// set ApplicationIdentifier
    /// </summary>
    /// <param name="applicationIdentifier" type="string">applicationIdentifier (e.g. DCS+)</param>
    framework.SetApplicationIdentifier(applicationIdentifier);
}