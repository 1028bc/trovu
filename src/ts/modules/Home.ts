// @ts-nocheck

/** @module Home */
import "../../scss/style.scss";
import CallHandler from "./CallHandler";
import Env from "./Env";
import GitLogger from "./GitLogger";
import Settings from "./home/Settings";
import Suggestions from "./home/Suggestions";
import "@fortawesome/fontawesome-free/js/all.min";

import * as BSN from "bootstrap.native";
import "bootstrap/dist/css/bootstrap.css";
import countriesList from "countries-list";

/** Set and manage the homepage. */

export default class Home {
  constructor() {}

  async initialize() {
    this.env = new Env({ context: "index" });
    this.queryInput = document.querySelector("#query");
    this.env.setContext();

    // Init environment.
    const params = Env.getParamsFromUrl();
    await this.env.populate(params);
    this.updateOpensearch();

    const gitLogger = new GitLogger(this.env.gitInfo);
    const versionElement = document.querySelector("#version");
    if (versionElement) versionElement.textContent = gitLogger.getVersion();
    gitLogger.logVersion();

    const modalElement = document.getElementById("settings");
    if (modalElement) {
      const modal = new BSN.Modal(modalElement);
    }

    // Fix: bind this context for the callback
    new Settings(this.env, this.updateOpensearch.bind(this));

    this.showInfoAlerts();
    this.setLocationHash();
    this.setQueryElement();

    // Toggle by query only after the query input is set.
    this.toggleByQuery();

    if (this.env.debug) {
      this.env.logger.showLog();
    }

    const queryForm = document.getElementById("query-form");
    if (queryForm) queryForm.onsubmit = this.submitQuery;

    const reloadLink = document.querySelector("#reload");
    if (reloadLink) {
      reloadLink.href = this.env.buildProcessUrl({
        query: "reload",
      });
    }
    document.documentElement.setAttribute("data-page-loaded", "true");

    Home.setHeights();
    this.setListeners();
    window.addEventListener(
      "hashchange",
      function () {
        window.location.reload();
      },
      false,
    );
    window.addEventListener("pageshow", (event) => {
      if (event.persisted) {
        // If true, the page was loaded from cache
        const queryInput = document.getElementById("query");
        if (queryInput) queryInput.focus();
      }
    });
  }

  static setHeights() {
    Home.setMaxHeightForSuggestions();
    window.onresize = Home.setMaxHeightForSuggestions;
  }

  static setMaxHeightForSuggestions() {
    const suggestionsDiv = document.querySelector("#suggestions");
    if (!suggestionsDiv) return;

    // Fallback value.
    suggestionsDiv.style.maxHeight = "200px";
    const suggestionsTop = suggestionsDiv.getBoundingClientRect().top;
    
    const footer = document.querySelector("footer");
    let footerTop;
    if (!footer || footer.style.display === "none") {
      footerTop = document.documentElement.clientHeight;
    } else {
      footerTop = footer.getBoundingClientRect().top;
    }
    const calculatedHeight = Math.max(0, footerTop - suggestionsTop);
    suggestionsDiv.style.maxHeight = calculatedHeight + "px";
  }

  setListeners() {
    this.setListenersToSetQuery("namespace", "ns");
    this.setListenersToSetQuery("tag", "tag");
  }
  
  setListenersToSetQuery(className, prefix) {
    const elements = document.querySelectorAll(`span.${className}`);
    elements.forEach((element) => {
      element.style.cursor = "pointer";
      element.addEventListener("click", () => {
        if (this.queryInput) {
          this.queryInput.value = `${prefix}:${element.textContent}`;
          this.suggestions.updateSuggestions();
          this.toggleByQuery();
          this.queryInput.focus();
        }
      });
    });
  }

  setQueryElement() {
    if (!this.queryInput) return;
    
    switch (this.env.status) {
      case "deprecated":
        this.queryInput.value = this.env.alternative;
        break;
      case "reloaded":
        this.queryInput.value = "";
        break;
      default:
        this.queryInput.value = this.env.query || "";
        break;
    }

    this.suggestions = new Suggestions("#query", "#suggestions", this);
    this.setToggleByQuery();
  }

  setToggleByQuery() {
    if (this.queryInput) {
      this.queryInput.addEventListener("input", () => {
        this.toggleByQuery();
      });
    }
    
    const suggestionsDiv = document.querySelector("#suggestions");
    if (suggestionsDiv) {
      suggestionsDiv.addEventListener("click", () => {
        this.toggleByQuery();
      });
    }
    
    document.querySelector("html").style.display = "block";
    if (this.queryInput) this.queryInput.focus();
  }

  toggleByQuery() {
    if (!this.queryInput) return;
    
    const isQueryEmpty = this.queryInput.value.trim() === "";
    const noSuggestionSelected = (!this.suggestions || this.suggestions.selected === -1);
    
    const navBar = document.querySelector("nav.navbar");
    const footer = document.querySelector("footer");
    const explainers = document.querySelectorAll(".explainer");
    const settingsButton = document.querySelector("#settings-button");
    const lists = document.querySelector("#lists");
    const suggestionsDiv = document.querySelector("#suggestions");
    const helpDiv = document.querySelector("#help");

    // Toggle display of navbar and examples.
    if (isQueryEmpty && noSuggestionSelected) {
      if (navBar) navBar.style.display = "block";
      if (!this.env.isRunningStandalone() && this.env.context !== "web-ext") {
        if (footer) footer.style.display = "block";
        explainers.forEach((el) => (el.style.display = "block"));
      }
      if (this.env.context === "web-ext" && settingsButton) {
        settingsButton.style.display = "none";
      }
      if (lists) lists.style.display = "block";
      if (suggestionsDiv) suggestionsDiv.style.display = "none";
      if (helpDiv) helpDiv.style.display = "none";
    } else {
      if (navBar) navBar.style.display = "none";
      if (footer) footer.style.display = "none";
      if (suggestionsDiv) suggestionsDiv.style.display = "block";
      if (helpDiv) helpDiv.style.display = "block";
      explainers.forEach((el) => (el.style.display = "none"));
      if (lists) lists.style.display = "none";
    }
    Home.setHeights();
  }

  setLocationHash() {
    const paramStr = this.env.buildUrlParamStr();
    window.location.hash = "#" + paramStr;
  }

  /**
   * Show custom alerts above query input.
   */
  showInfoAlerts() {
    const params = Env.getParamsFromUrl();
    const alert = document.querySelector("#alert");
    
    if (!alert) return;
    
    const alertMsg = alert.querySelector("span");
    const alertClose = alert.querySelector("button");
    
    if (alertClose) {
      alertClose.addEventListener("click", () => {
        const paramStr = this.env.buildUrlParamStr({ query: undefined, status: undefined });
        window.location.hash = "#" + paramStr;
      });
    }
    
    if (params.status) {
      alert.removeAttribute("hidden");
    }
    
    if (!alertMsg) return;

    const docsUrl = this.env.data?.config?.url?.docs || "";
    const safeCountry = (this.env.country || "us").toUpperCase();
    const safeLanguage = (this.env.language || "en").toUpperCase();

    switch (params.status) {
      case "not_found":
        alertMsg.innerHTML = `No matching shortcut found. Did you use a <a href="${docsUrl}users/#call-a-shortcut">keyword</a>? Try <a target="_blank" href="${docsUrl}users/troubleshooting/">Troubleshooting</a>.`;
        break;
      case "not_reachable":
        alertMsg.innerHTML = `This shortcut is not <a target="_blank" href="${
          docsUrl
        }shortcuts/namespaces/#priority-of-namespaces">reachable</a>.  Change your settings (${safeLanguage} ${
          countriesList.countries[safeCountry]?.emoji || ""
        }) to <span class="namespace"></span>.`;
        const namespaceSpan = alertMsg.querySelector(".namespace");
        if (namespaceSpan) namespaceSpan.textContent = params.namespace;
        break;
      case "reloaded":
        alertMsg.textContent = "Shortcuts were reloaded in all namespaces.";
        if (this.env.github) {
          alertMsg.innerHTML +=
            " Changes on your GitHub might require a reload in <strong>5 minutes</strong> due to caching.";
        }
        break;
      case "deprecated":
        alertMsg.innerHTML = 'Your shortcut <strong><em class="query"></em></strong> is deprecated. Please use:';
        const queryEm = alertMsg.querySelector(".query");
        if (queryEm) queryEm.textContent = params.query;
        break;
      case "removed":
        alertMsg.innerHTML = `The shortcut <a class="githubLink" target="_blank" href=""></a> was removed as does not adhere to our 
          <a target="_blank" href="${docsUrl}editors/policy/">Content policy</a>. 
          But you can <a target="_blank" href="${docsUrl}users/advanced/">
          create a user shortcut in your own namespace</a>.`;
        const githubLink = alertMsg.querySelector("a.githubLink");
        if (githubLink) {
          githubLink.textContent = params.query;
          githubLink.href = `https://github.com/search?l=&q=${encodeURIComponent(
            params.key || "",
          )}+repo%3Atrovu%2Ftrovu-data&type=code`;
        }
        break;
    }
  }

  /**
   * On submitting the query.
   *
   * @param {object} event – The submitting event.
   */
  submitQuery = async (event) => {
    // Prevent default sending as GET parameters.
    if (event) {
      event.preventDefault();
    }

    // Must create new env instance here,
    // because extraNamespace might have changed reachability,
    // or asking for a not yet parsed Github namespace.
    const envQuery = new Env({ context: "index" });
    const params = Env.getParamsFromUrl();
    params.query = this.queryInput ? this.queryInput.value : "";
    await envQuery.populate(params);

    const response = CallHandler.getRedirectResponse(envQuery);

    // Send debug to /process.
    if (envQuery.debug) {
      const processUrl = this.env.buildProcessUrl({
        query: this.queryInput ? this.queryInput.value : "",
      });
      window.location.href = processUrl;
      return;
    }

    // Standard redirect.
    if (response && response.url) {
      window.location.href = response.url;
    }
  };

  /**
   * Add and update Opensearch tag.
   */
  updateOpensearch() {
    // 1. Remove any stale opensearch links
    const existingLinkSearch = document.querySelector('link[rel="search"]');
    if (existingLinkSearch) {
      existingLinkSearch.remove();
    }

    // 2. Build the new link
    const linkSearch = document.createElement("link");
    linkSearch.id = "opensearch";
    linkSearch.rel = "search";
    linkSearch.type = "application/opensearchdescription+xml";

    // 3. Set the title based on the user's environment
    let title = "Trovu: ";
    if (this.env.github) {
      title += this.env.github;
    } else if (this.env.configUrl) {
      title += this.env.configUrl;
