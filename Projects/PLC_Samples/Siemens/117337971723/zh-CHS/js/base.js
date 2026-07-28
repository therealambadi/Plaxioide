/*!
 *
 * (Copyright (c) 2016 Siemens AG
 *
 * Creator: Betz 2015
 *
 * Lib:  Base
 *
 */

/* global framework*/


function GoBack() {
    /// <summary>
    /// temp. not in use
    /// </summary>
    window.history.back();
}
function TopicContent_CopyProgramCode(elem, lbl) {
    /// <summary>
    /// Diese Funktion wird aus den Topic Content aufgerufen
    /// Dev-Info: wird in der content.xslt verbaut
    /// </summary>
    framework.clipboard.copyProgramCode(elem, lbl);
}
function TopicContent_NavigateExternal(target, type) {
    /// <summary>
    /// Diese Funktion wird aus den Topic Content aufgerufen
    /// Dev-Info: wird in der content.xslt verbaut
    /// </summary>
    framework.topic.NavigateExternal(target, type);
}
function TopicContent_ScrollToElem(elem) {
    /// <summary>
    /// Diese Funktion wird aus den Topic Content aufgerufen
    /// Dev-Info: wird in der content.xslt verbaut
    /// </summary>
    framework.scroll.scrollToElem(elem);
}
function TopicContent_DisplayExpandingGlossaryEntry(elem) {
    /// <summary>
    /// Blendet für den angewählten Hotspot vom Typ expandingGlossary den Zusatztext ein bzw. aus.
    /// Dev-Info: wird in der content.xslt verbaut
    /// </summary>
    /// <param name="elem"></param>
    framework.glossary.ToggleGlossaryEntry(elem);
}
function TopicContent_NavWithCaller(caller, key, searchText, detailTarget) {
    framework.navigation.navWithCaller(caller, key, searchText, detailTarget);
}
function NavSearch(searchText, currentPage) {
    /// <summary>
    /// Diese Funktion bei der Suche aufgerufen
    /// Dev-Info: wird in der framework.search.js verbaut
    /// </summary>
    framework.search.SetSearchCmd(searchText, currentPage);
}
function NavIndex(idx, currentPage, searchTextIsKey) {
    /// <summary>
    /// Diese Funktion beim Index aufgerufen
    /// Dev-Info: wird in der framework.index.js verbaut
    /// </summary>
    framework.index.SetIndexCmd(idx, currentPage, searchTextIsKey);
}
function NavIndexSearch(searchText, currentPage) {
    /// <summary>
    /// Diese Funktion beim Index aufgerufen
    /// Dev-Info: wird in der framework.index.js verbaut
    /// </summary>
    framework.index.SetIndexSearchCmd(searchText, currentPage);
}
function NavGlossary(key) {
    /// <summary>
    /// Diese Funktion beim Glossary aufgerufen
    /// Dev-Info: wird in der framework.glossary.js verbaut
    /// </summary>
    framework.glossary.SetGlossaryCmd(key);
}
function NavWithCaller(caller, key, searchText, detailTarget) {
    /// <summary>
    /// Diese ist eien alte funktion die noch in den Ausleitungen
    /// von SIPS drin ist
    /// </summary>
    /// <param name="caller"></param>
    /// <param name="key"></param>
    /// <param name="searchText"></param>
    //caller = content -> content
    //caller = prev = content
    //caller = next = content
    framework.navigation.navWithCaller(caller, key, searchText, detailTarget);
}


