(function () {
  console.log('Custom Client Portal Script Loaded v1.0');
  // Data attributes from script tag
  var api = document.currentScript.getAttribute("data-api-key");
  var locationId = document.currentScript.getAttribute("data-location-id");
  var logoUrl = document.currentScript.getAttribute("data-logo-url");
  var companyWebsite = document.currentScript.getAttribute("data-company-website");
  var afterImages = document.currentScript.getAttribute("data-after-images-id");
  var beforeImages = document.currentScript.getAttribute("data-before-images-id");
  var sharedFiles = document.currentScript.getAttribute("data-shared-files-id");

  const scriptConfig = {
    apiKey: api,
    locationId: locationId,
    logoUrl: logoUrl,
    companyWebsite: companyWebsite
  };

  // Configuration
  const CONFIG = {
    api: {
      token: scriptConfig.apiKey,
    },
    customFields: {
      afterImages: afterImages || "J7yOa10VTpuQFwwpup9w",
      beforeImages: beforeImages || "4frR2sKYAEhhzacBfn82",
      sharedFiles: sharedFiles || "4frR2sKYAEhhzacBfnew1",
    },
    branding: {
      logoUrl: scriptConfig.logoUrl || "https://storage.googleapis.com/msgsndr/vaLJtqDBxqs7iQL1IIB2/media/697cfd601fd827343cf42947.png",
      companyWebsite: scriptConfig.companyWebsite || `https://${scriptConfig.locationId}.app.clientclub.net/home`,
    },
    fonts: {
      family: "'Inter', 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif",
      weights: { normal: 400, medium: 500, semibold: 600, bold: 700 },
    },
  };

  // Static configuration
  const STATIC_CONFIG = {
    api: {
      baseUrl: "https://services.leadconnectorhq.com",
      version: "2021-07-28",
    },
    customFields: {
      opportunityTrackHelper: "opportunity_track_helper",
    },
    gallery: {
      itemsPerPage: 4,
    },
    stages: {
      "Deposit Due": 1,
      "Survey To Be Scheduled": 2,
      "Survey Scheduled": 3,
      "Get Contract Ready": 4,
      "Contract To Be Signed": 5,
      "Items To Be Ordered": 6,
      "Items To Be Signed Off": 7,
      "Waiting For Delivery": 8,
      "Fitting Date To Be Scheduled": 9,
      "Fitting Date Scheduled": 10,
      "Installation Complete": 11,
      "Balance To Be Collected": 12,
      "Job Complete": 13,
    },
    redirects: {
      login: "/login",
    },
  };

  // CSS Variable references (matching :root in index.css)
  const CSS_VARS = {
    primary: 'var(--primary)',
    primaryHover: 'var(--primary-hover)',
    secondary: 'var(--secondary)',
    secondaryHover: 'var(--secondary-hover)',
    neutral: 'var(--neutral)',
    bgMain: 'var(--bg-main)',
    bgCard: 'var(--bg-card)',
    textDark: 'var(--text-dark)',
    textMedium: 'var(--text-medium)',
    textLight: 'var(--text-light)',
    textSecondary: 'var(--text-secondary)',
    border: 'var(--border)',
    success: 'var(--success)',
    successBg: 'var(--success-bg)',
    warning: 'var(--warning)',
    warningBg: 'var(--warning-bg)',
    error: 'var(--error)',
    errorBg: 'var(--error-bg)',
    info: 'var(--info)',
    infoBg: 'var(--info-bg)',
  };

  // Refresh page on window width change
  let initialWidth = window.innerWidth;
  let resizeTimeout;

  window.addEventListener("resize", function () {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(function () {
      if (window.innerWidth !== initialWidth) {
        location.reload();
      }
    }, 250);
  });

  // Global state
  var opportunitiesData = null;
  var currentOpportunityId = null;
  var contactFirstName = null;
  var currentGalleryPage = 0;
  var galleryItemsPerPage = STATIC_CONFIG.gallery.itemsPerPage;
  var currentGalleryItems = [];
  var currentGalleryType = "before";

  // Get contact ID from URL params or localStorage
  function getContactId() {
    const urlParams = new URLSearchParams(window.location.search);
    const contactId = urlParams.get("contactId") || urlParams.get("contact_id");
    if (contactId) return contactId;

    const storedContactId = localStorage.getItem("contactId") || localStorage.getItem("contact_id");
    if (storedContactId) return storedContactId;

    try {
      const eventData = localStorage.getItem("event");
      if (eventData) {
        const event = JSON.parse(eventData);
        if (event && event.contactId) return event.contactId;
      }
    } catch (error) {
      console.error("Error parsing event:", error);
    }
    return null;
  }

  // Fetch contact data from API
  function fetchContactData(contactId) {
    const apiUrl = `${STATIC_CONFIG.api.baseUrl}/contacts/${contactId}`;
    return fetch(apiUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Version: STATIC_CONFIG.api.version,
        Authorization: `Bearer ${CONFIG.api.token}`,
      },
    })
      .then((response) => {
        if (response.ok) return response.json();
        return Promise.reject("API Error");
      })
      .catch((error) => {
        console.error("Fetch error:", error);
        throw error;
      });
  }

  // Parse opportunities data from custom fields
  function parseOpportunitiesData(customFields) {
    if (!customFields || !Array.isArray(customFields)) return null;

    const matchingField = customFields.find(
      (field) => field.value && typeof field.value === "string" && field.value.includes("total_lead_in_hlelite_helper_kit")
    );

    if (!matchingField) return null;

    try {
      const parsedData = JSON.parse(matchingField.value);
      if (Array.isArray(parsedData) && parsedData.length > 0) {
        const opportunities = [];
        parsedData.forEach((item) => {
          Object.keys(item).forEach((oppId) => {
            opportunities.push({ id: oppId, ...item[oppId] });
          });
        });
        return opportunities;
      }
      return null;
    } catch (error) {
      console.error("Error parsing opportunities:", error);
      return null;
    }
  }

  function getStageNumber(stageName) {
    return STATIC_CONFIG.stages[stageName] || 1;
  }

  function getCurrentOpportunity() {
    if (!opportunitiesData || !currentOpportunityId) return null;
    return opportunitiesData.find((opp) => opp.id === currentOpportunityId);
  }

  // Update cards with current opportunity data
  function updateCardsWithData() {
    const opportunity = getCurrentOpportunity();
    if (!opportunity) {
      initializeProgressTracking(1);
      return;
    }

    const dropdownValue = document.querySelector(".custom-order-dropdown-value");
    if (dropdownValue) {
      dropdownValue.textContent = `Order #${opportunity.contract_number} – ${opportunity.name}`;
    }

    const contractNumber = document.querySelector(".custom-contract-number");
    if (contractNumber) contractNumber.textContent = `#${opportunity.contract_number || "N/A"}`;

    const customerName = document.querySelector(".custom-customer-name");
    if (customerName) customerName.textContent = opportunity.TitleLastName || "Customer";

    const paymentDueNow = document.querySelector(".custom-payment-due-now");
    if (paymentDueNow) paymentDueNow.textContent = `£${parseFloat(opportunity.payment_due_now || 0).toFixed(2)}`;

    const balanceOutstanding = document.querySelector(".custom-balance-outstanding");
    if (balanceOutstanding) balanceOutstanding.textContent = `£${parseFloat(opportunity.balance_outstanding || 0).toFixed(2)}`;

    const contractValue = document.querySelector(".custom-contract-value");
    if (contractValue) contractValue.textContent = `£${parseFloat(opportunity.contract_value || 0).toFixed(2)}`;

    // Update invoices
    const invoiceContainers = document.querySelectorAll("#invoiceContainer");
    const invoiceCards = document.querySelectorAll("#invoicesCard");

    if (invoiceContainers && invoiceContainers.length > 0) {
      const invoices = opportunity.invoice;
      const hasInvoices = invoices && Array.isArray(invoices) && invoices.length > 0;

      if (hasInvoices) {
        invoiceCards.forEach((card) => { if (card) card.style.display = "block"; });

        let invoiceHTML = "";
        invoices.forEach((invoice) => {
          const invoiceNo = invoice.invoice_no || "N/A";
          const invoiceStatus = invoice.invoice_status || "Unknown";
          const invoiceUrl = invoice.invoice_url || "#";

          let statusColor = CSS_VARS.neutral;
          let statusBg = CSS_VARS.bgMain;

          if (invoiceStatus.toLowerCase() === "paid") {
            statusColor = CSS_VARS.success;
            statusBg = CSS_VARS.successBg;
          } else if (invoiceStatus.toLowerCase() === "unpaid" || invoiceStatus.toLowerCase() === "pending") {
            statusColor = CSS_VARS.error;
            statusBg = CSS_VARS.errorBg;
          } else if (invoiceStatus.toLowerCase() === "partially_paid") {
            statusColor = CSS_VARS.warning;
            statusBg = CSS_VARS.warningBg;
          }

          invoiceHTML += `
            <div style="padding: 0.75rem; border: 1px solid ${CSS_VARS.border}; border-radius: 6px; margin-bottom: 0.5rem; background: white;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <div style="flex: 1;">
                  <div style="font-weight: 600; color: ${CSS_VARS.textDark}; margin-bottom: 0.25rem;">Invoice #${invoiceNo}</div>
                  <div style="display: inline-block; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 500; color: ${statusColor}; background: ${statusBg};">${invoiceStatus}</div>
                </div>
                <a href="${invoiceUrl}" target="_blank" class="custom-primary-btn">View Invoice</a>
              </div>
            </div>
          `;
        });
        invoiceContainers.forEach((container) => { container.innerHTML = invoiceHTML; });
      } else {
        invoiceCards.forEach((card) => { if (card) card.style.display = "none"; });
      }
    }

    const stageNumber = getStageNumber(opportunity.stage);
    initializeProgressTracking(stageNumber);

    const activeTab = document.querySelector(".photo-tab-btn.tab-active");
    if (activeTab) {
      const tabType = activeTab.getAttribute("data-gallery-type") || "before";
      const galleryGrid = document.getElementById("photoDisplayGrid");
      if (galleryGrid) {
        const items = tabType === "before" ? opportunity.BeforeImages : opportunity.AfterImages;
        renderGalleryItems(items, tabType);
      }
    }

    const activeDocTab = document.querySelector("[data-doc-type].tab-active");
    if (activeDocTab) {
      const docType = activeDocTab.getAttribute("data-doc-type") || "contracts";
      renderDocumentContent(docType);
    }
  }

  // Render gallery items
  function renderGalleryItems(items, tabType) {
    const galleryGrids = document.querySelectorAll("#photoDisplayGrid");
    if (!galleryGrids || galleryGrids.length === 0) return;

    if (!items || !Array.isArray(items) || items.length === 0) {
      galleryGrids.forEach((galleryGrid) => {
        galleryGrid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: ${CSS_VARS.neutral}; padding: 2rem;">No images available</p>`;
      });
      return;
    }

    const startIndex = currentGalleryPage * galleryItemsPerPage;
    const endIndex = startIndex + galleryItemsPerPage;
    const paginatedItems = items.slice(startIndex, endIndex);

    const galleryHTML = paginatedItems.map((item, index) => {
      const url = typeof item === "string" ? item : item.url || item.URL || item;

      if (isPDF(url)) {
        return `
          <div class="photo-card" data-url="${url}" data-type="pdf" style="overflow: hidden; width: 100%; height: 100%; box-sizing: border-box;">
            <div style="width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; background: ${CSS_VARS.bgMain}; cursor: pointer; box-sizing: border-box;">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="${CSS_VARS.primary}" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <text x="12" y="16" text-anchor="middle" fill="${CSS_VARS.primary}" font-size="6" font-weight="bold">PDF</text>
              </svg>
              <span style="font-size: 0.75rem; color: ${CSS_VARS.textMedium}; margin-top: 0.5rem;">Click to open</span>
            </div>
          </div>
        `;
      } else if (isImage(url)) {
        return `
          <div class="photo-card" data-url="${url}" data-type="image" style="overflow: hidden; width: 100%; height: 100%; box-sizing: border-box;">
            <img src="${url}" alt="${tabType} ${index + 1}" style="width: 100%; height: 100%; object-fit: cover; cursor: pointer; display: block; box-sizing: border-box;">
          </div>
        `;
      } else {
        return `
          <div class="photo-card" data-url="${url}" data-type="file" style="overflow: hidden; width: 100%; height: 100%; box-sizing: border-box;">
            <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: ${CSS_VARS.bgMain}; cursor: pointer; box-sizing: border-box;">
              <span style="font-size: 0.75rem; color: ${CSS_VARS.textMedium};">View File</span>
            </div>
          </div>
        `;
      }
    }).join("");

    galleryGrids.forEach((galleryGrid) => {
      galleryGrid.innerHTML = galleryHTML;
      galleryGrid.style.width = "100%";
      galleryGrid.style.maxWidth = "100%";
      galleryGrid.style.overflow = "hidden";
      galleryGrid.style.boxSizing = "border-box";
    });

    setTimeout(() => {
      document.querySelectorAll(".photo-card").forEach((item) => {
        item.addEventListener("click", () => {
          const url = item.getAttribute("data-url");
          window.open(url, "_blank");
        });
      });
    }, 100);
  }

  // Load contact data on page load
  function loadContactData() {
    const contactId = getContactId();
    if (!contactId) {
      initializeStaticUI();
      return;
    }

    fetchContactData(contactId)
      .then((data) => {
        if (data.contact) {
          contactFirstName = data.contact.firstName || data.contact.name || "there";
          addWelcomeMessage();
        }

        if (data.contact && data.contact.customFields) {
          opportunitiesData = parseOpportunitiesData(data.contact.customFields);

          if (opportunitiesData && opportunitiesData.length > 0) {
            currentOpportunityId = opportunitiesData[0].id;
            initializeDynamicUI();
          } else {
            initializeStaticUI();
          }
        } else {
          initializeStaticUI();
        }
      })
      .catch(() => {
        initializeStaticUI();
      });
  }

  // Initialize with dynamic data from API
  function initializeDynamicUI() {
    waitforElement(".left-0.right-0.top-0.nav-container.border-clientportal-border", function (topMenu) {
      topMenu.classList.add("my-custom-button-container");
      var cardsContainer = document.createElement("div");
      cardsContainer.id = "custom-cards-container";

      var orderSelector = document.createElement("div");
      orderSelector.className = "custom-order-selector";

      let dropdownHTML = '<select class="custom-order-dropdown" id="orderDropdown">';
      opportunitiesData.forEach((opp) => {
        const selected = opp.id === currentOpportunityId ? "selected" : "";
        dropdownHTML += `<option value="${opp.id}" ${selected}>Order #${opp.contract_number} – ${opp.name}</option>`;
      });
      dropdownHTML += "</select>";
      orderSelector.innerHTML = dropdownHTML;

      setTimeout(() => {
        const dropdown = document.getElementById("orderDropdown");
        if (dropdown) {
          dropdown.addEventListener("change", function (e) {
            currentOpportunityId = e.target.value;
            updateCardsWithData();
          });
        }
      }, 100);

      var welcomeMsg = document.createElement("div");
      welcomeMsg.className = "custom-welcome-message";
      welcomeMsg.innerHTML = `Welcome back, <strong>${contactFirstName || "there"}</strong> 👋`;
      cardsContainer.appendChild(welcomeMsg);

      cardsContainer.appendChild(orderSelector);
      createCards(cardsContainer);
      topMenu.parentNode.insertBefore(cardsContainer, topMenu.nextSibling);

      const opportunity = getCurrentOpportunity();
      const stageNumber = opportunity ? getStageNumber(opportunity.stage) : 1;
      initializeProgressTracking(stageNumber);
      initializeGalleryTabs();
      initializeDocumentTabs();
      updateCardsWithData();
    });
  }

  // Create all cards
  function createCards(cardsContainer) {
    var progressCard = document.createElement("div");
    progressCard.className = "custom-card";
    progressCard.innerHTML = `
      <h2 class="custom-card-title">Order Progress</h2>
      <div class="custom-progress-container">
        <div class="custom-progress-steps" id="customProgressSteps"></div>
      </div>
      <p class="custom-progress-status" id="customProgressStatus">Your order is being processed.</p>
    `;
    cardsContainer.appendChild(progressCard);

    var gridContainer = document.createElement("div");
    gridContainer.className = "custom-grid-2";
    gridContainer.style.cssText = "overflow: hidden; width: 100%; max-width: 100%; box-sizing: border-box;";

    var financialCard = document.createElement("div");
    financialCard.className = "custom-card";
    financialCard.style.cssText = "overflow: hidden; box-sizing: border-box;";
    financialCard.innerHTML = `
      <h2 class="custom-card-title">Financial Information</h2>
      <div class="custom-financial-row">
        <span class="custom-financial-label">Contract Value:</span>
        <span class="custom-financial-value custom-contract-value">£5,000.00</span>
      </div>
      <div class="custom-financial-row">
        <span class="custom-financial-label">Balance Outstanding:</span>
        <span class="custom-financial-value custom-balance-outstanding">£0.00</span>
      </div>
      <div class="custom-financial-row">
        <span class="custom-financial-label">Payment Due Now:</span>
        <span class="custom-financial-value custom-payment-due-now">£0.00</span>
      </div>
    `;
    gridContainer.appendChild(financialCard);

    var galleryCard = document.createElement("div");
    galleryCard.className = "custom-card";
    galleryCard.style.cssText = "overflow: hidden; box-sizing: border-box; width: 100%;";
    galleryCard.innerHTML = `
      <h2 class="custom-card-title">Photo Gallery</h2>
      <div class="photo-showcase-tabs">
        <button class="photo-tab-btn tab-active" data-gallery-type="before">Before Photos</button>
        <button class="photo-tab-btn" data-gallery-type="after">After Photos</button>
      </div>
      <div class="photo-carousel-wrap" style="overflow: hidden; width: 100%;">
        <button class="carousel-nav-btn nav-btn-prev" id="photoPrevious">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <div class="photo-display-area" style="overflow: hidden; width: 100%;">
          <div class="photo-items-grid" id="photoDisplayGrid" style="width: 100%; max-width: 100%; overflow: hidden;">
            <p style="grid-column: 1/-1; text-align: center; color: ${CSS_VARS.neutral}; padding: 2rem;">No images available</p>
          </div>
        </div>
        <button class="carousel-nav-btn nav-btn-next" id="photoNext">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      </div>
    `;
    gridContainer.appendChild(galleryCard);
    cardsContainer.appendChild(gridContainer);

    var invoicesCard = document.createElement("div");
    invoicesCard.className = "custom-card";
    invoicesCard.id = "invoicesCard";
    invoicesCard.innerHTML = `
      <h2 class="custom-card-title">Invoices</h2>
      <div id="invoiceContainer" class="custom-invoice-container"></div>
    `;
    cardsContainer.appendChild(invoicesCard);

    var documentsCard = document.createElement("div");
    documentsCard.className = "custom-card";
    documentsCard.innerHTML = `
      <h2 class="custom-card-title">Documents & Contracts</h2>
      <div class="photo-showcase-tabs">
        <button class="photo-tab-btn tab-active" data-doc-type="contracts">Contracts</button>
        <button class="photo-tab-btn" data-doc-type="estimates">Estimates</button>
        <button class="photo-tab-btn" data-doc-type="shared">Shared Documents</button>
      </div>
      <div id="documentsDisplayArea" class="custom-documents-area" style="margin-top: 1rem;"></div>
    `;
    cardsContainer.appendChild(documentsCard);
  }

  // Show No Data Found error
  function showNoDataError(errorMessage) {
    waitforElement(".flex.flex-col.items-start.py-6", function (topMenu) {
      topMenu.classList.add("my-custom-button-container");
      var errorContainer = document.createElement("div");
      errorContainer.id = "custom-cards-container";
      errorContainer.innerHTML = `
        <div class="custom-welcome-message">Welcome back, <strong>${contactFirstName || "there"}</strong> 👋</div>
        <div class="custom-no-data-error">
          <div class="custom-error-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </div>
          <h2 class="custom-error-title">No Data Found</h2>
          <p class="custom-error-message">${errorMessage || "We could not find any order data for your account. Please contact support if you believe this is an error."}</p>
          <button class="custom-error-retry-btn" onclick="location.reload()">Try Again</button>
        </div>
      `;
      topMenu.parentNode.insertBefore(errorContainer, topMenu.nextSibling);
    });

    waitforElement(".col-span-3.flex.flex-col.items-center.justify-start.left-0.right-0.fixed.z-50", function (mobileTarget) {
      var mobileErrorContainer = document.createElement("div");
      mobileErrorContainer.className = "custom-mobile-container";
      mobileErrorContainer.id = "custom-mobile-cards-container";
      mobileErrorContainer.innerHTML = `
        <div class="custom-welcome-message">Welcome back, <strong>${contactFirstName || "there"}</strong> 👋</div>
        <div class="custom-no-data-error">
          <div class="custom-error-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </div>
          <h2 class="custom-error-title">No Data Found</h2>
          <p class="custom-error-message">${errorMessage || "We could not find any order data for your account. Please contact support if you believe this is an error."}</p>
          <button class="custom-error-retry-btn" onclick="location.reload()">Try Again</button>
        </div>
      `;
      mobileTarget.parentNode.insertBefore(mobileErrorContainer, mobileTarget.nextSibling);
    });
  }

  function initializeStaticUI() {
    showNoDataError("No opportunities or order data found for your account.");
  }

  // Add logo to nav-container
  function addLogoToNav() {
    waitforElement(".nav-container", function (navContainer) {
      if (navContainer.querySelector(".custom-nav-logo")) return;

      var logoLink = document.createElement("a");
      logoLink.href = CONFIG.branding.companyWebsite;
      logoLink.target = "_blank";
      logoLink.className = "custom-nav-logo";

      var logoImg = document.createElement("img");
      logoImg.src = CONFIG.branding.logoUrl;
      logoImg.alt = "Company Logo";
      logoLink.appendChild(logoImg);

      navContainer.insertBefore(logoLink, navContainer.firstChild);
    });
  }

  addLogoToNav();

  // Add logout button
  function addLogoutButton() {
    waitforElement("#btn-notification", function (btnNotification) {
      const parentDiv = btnNotification.parentElement;
      if (!parentDiv || parentDiv.querySelector(".custom-desktop-logout-btn")) return;

      var logoutBtn = document.createElement("button");
      logoutBtn.textContent = "Logout";
      logoutBtn.className = "custom-desktop-logout-btn";

      logoutBtn.addEventListener("click", function () {
        localStorage.clear();
        document.cookie.split(";").forEach(function (c) {
          document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
        });
        window.location.href = STATIC_CONFIG.redirects.login;
      });

      btnNotification.parentNode.insertBefore(logoutBtn, btnNotification.nextSibling);
    });
  }

  addLogoutButton();

  // Add welcome message
  function addWelcomeMessage() {
    waitforElement("#custom-cards-container", function (cardsContainer) {
      if (cardsContainer.querySelector(".custom-welcome-message")) {
        const existingWelcome = cardsContainer.querySelector(".custom-welcome-message");
        existingWelcome.innerHTML = `Welcome back, <strong>${contactFirstName || "there"}</strong> 👋`;
        return;
      }

      var welcomeMsg = document.createElement("div");
      welcomeMsg.className = "custom-welcome-message";
      welcomeMsg.innerHTML = `Welcome back, <strong>${contactFirstName || "there"}</strong> 👋`;
      cardsContainer.insertBefore(welcomeMsg, cardsContainer.firstChild);
    });
  }

  // Add mobile logo and logout
  function addMobileLogoAndLogout() {
    waitforElement("#id-mobile-switch", function (mobileSwitch) {
      const parentDiv = mobileSwitch.parentElement;
      if (!parentDiv || parentDiv.querySelector(".custom-mobile-nav-logo") || parentDiv.querySelector(".custom-mobile-logout-btn")) return;

      mobileSwitch.remove();

      const navContainer = document.createElement("div");
      navContainer.className = "custom-mobile-nav-container";

      const logoLink = document.createElement("a");
      logoLink.href = CONFIG.branding.companyWebsite;
      logoLink.target = "_blank";
      logoLink.className = "custom-mobile-nav-logo";

      const logoImg = document.createElement("img");
      logoImg.src = CONFIG.branding.logoUrl;
      logoImg.alt = "Company Logo";
      logoLink.appendChild(logoImg);

      const logoutBtn = document.createElement("button");
      logoutBtn.textContent = "Logout";
      logoutBtn.className = "custom-mobile-logout-btn";

      logoutBtn.addEventListener("click", function () {
        localStorage.clear();
        document.cookie.split(";").forEach(function (c) {
          document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
        });
        window.location.href = STATIC_CONFIG.redirects.login;
      });

      navContainer.appendChild(logoLink);
      navContainer.appendChild(logoutBtn);
      parentDiv.appendChild(navContainer);
    });
  }

  addMobileLogoAndLogout();
  loadContactData();

  // Mobile UI initialization
  function initializeMobileUI() {
    waitforElement(".col-span-3.flex.flex-col.items-center.justify-start.left-0.right-0.fixed.z-50", function (mobileTarget) {
      var mobileContainer = document.createElement("div");
      mobileContainer.className = "custom-mobile-container";
      mobileContainer.id = "custom-mobile-cards-container";

      var mobileWelcomeMsg = document.createElement("div");
      mobileWelcomeMsg.className = "custom-welcome-message";
      mobileWelcomeMsg.innerHTML = `Welcome back, <strong>${contactFirstName || "there"}</strong> 👋`;
      mobileContainer.appendChild(mobileWelcomeMsg);

      if (opportunitiesData && opportunitiesData.length > 0) {
        var orderSelector = document.createElement("div");
        orderSelector.className = "custom-order-selector";

        let dropdownHTML = '<select class="custom-order-dropdown" id="mobileOrderDropdown" style="width: 100%;">';
        opportunitiesData.forEach((opp) => {
          const selected = opp.id === currentOpportunityId ? "selected" : "";
          dropdownHTML += `<option value="${opp.id}" ${selected}>Order #${opp.contract_number} – ${opp.TitleLastName}</option>`;
        });
        dropdownHTML += "</select>";
        orderSelector.innerHTML = dropdownHTML;
        mobileContainer.appendChild(orderSelector);

        setTimeout(() => {
          const dropdown = document.getElementById("mobileOrderDropdown");
          if (dropdown) {
            dropdown.addEventListener("change", function (e) {
              currentOpportunityId = e.target.value;
              updateCardsWithData();
            });
          }
        }, 100);
      }

      createCards(mobileContainer);
      mobileTarget.parentNode.insertBefore(mobileContainer, mobileTarget.nextSibling);

      const opportunity = getCurrentOpportunity();
      if (opportunity) {
        initializeProgressTracking(getStageNumber(opportunity.stage));
      } else {
        initializeProgressTracking(10);
      }
      initializeGalleryTabs();
      initializeDocumentTabs();

      if (opportunitiesData && opportunitiesData.length > 0) {
        updateCardsWithData();
      }
    });
  }

  setTimeout(initializeMobileUI, 500);


  // Wait for element helper
  function waitforElement(selector, callback) {
    var attempts = 0;
    var interval = setInterval(function () {
      attempts++;
      var element = document.querySelector(selector);
      if (element) {
        clearInterval(interval);
        callback(element);
      } else if (attempts > 100) {
        clearInterval(interval);
      }
    }, 100);
  }

  // Progress Tracking
  function initializeProgressTracking(stageNumber) {
    updateProgressContainer(stageNumber, "customProgressSteps", "customProgressStatus");
  }

  function updateProgressContainer(stageNumber, stepsId, statusId) {
    const displayStages = [
      { id: "survey", label: "Survey Scheduled" },
      { id: "contract_pending", label: "Contract To Be Signed" },
      { id: "contract_signed", label: "Contract Signed" },
      { id: "items_ordered", label: "Items Ordered" },
      { id: "fitting", label: "Fitting Date Scheduled" },
      { id: "complete", label: "Installation Complete" },
    ];

    function getDisplayInfo(pipelineStage) {
      const stage = parseInt(pipelineStage);
      switch (stage) {
        case 1: return { activeIndex: -1, completedCount: 0, status: "Awaiting deposit payment to proceed." };
        case 2: return { activeIndex: -1, completedCount: 0, status: "We will contact you to schedule your survey." };
        case 3: return { activeIndex: 0, completedCount: 0, status: "Your survey has been scheduled." };
        case 4: return { activeIndex: 1, completedCount: 1, status: "We are preparing your contract." };
        case 5: return { activeIndex: 1, completedCount: 1, status: "Your contract is ready to be signed." };
        case 6: return { activeIndex: 2, completedCount: 2, status: "Your contract has been signed. Items will be ordered shortly." };
        case 7: return { activeIndex: 3, completedCount: 3, status: "Items are being signed off for ordering." };
        case 8: return { activeIndex: 3, completedCount: 3, status: "Your items have been ordered and are awaiting delivery." };
        case 9: return { activeIndex: 4, completedCount: 4, status: "We will contact you to schedule your fitting date." };
        case 10: return { activeIndex: 4, completedCount: 4, status: "Your fitting date has been scheduled." };
        case 11: return { activeIndex: 5, completedCount: 5, status: "Installation is complete!" };
        case 12: return { activeIndex: 5, completedCount: 6, status: "Installation complete. Please settle the remaining balance." };
        case 13: return { activeIndex: 5, completedCount: 6, status: "Your order is complete. Thank you for your business!" };
        default: return { activeIndex: 0, completedCount: 0, status: "Processing your order." };
      }
    }

    const pipelineStage = stageNumber || 1;
    const displayInfo = getDisplayInfo(pipelineStage);

    const stepsContainers = document.querySelectorAll("#" + stepsId);
    const statusTexts = document.querySelectorAll("#" + statusId);

    if (stepsContainers.length === 0 || statusTexts.length === 0) return;

    let stepsHTML = "";
    displayStages.forEach((stage, index) => {
      let stepClass = "custom-progress-step";
      if (index < displayInfo.completedCount) {
        stepClass += " completed";
      } else if (index === displayInfo.activeIndex) {
        stepClass += " active";
      }
      stepsHTML += `<div class="${stepClass}"><span class="custom-step-indicator">✓</span><span class="custom-step-label">${stage.label}</span></div>`;
    });

    stepsContainers.forEach((container) => { container.innerHTML = stepsHTML; });
    statusTexts.forEach((text) => { text.textContent = displayInfo.status; });
  }

  function isPDF(url) {
    if (!url) return false;
    const urlLower = url.toLowerCase();
    return urlLower.endsWith(".pdf") || urlLower.includes(".pdf?") || urlLower.includes("pdf");
  }

  function isImage(url) {
    if (!url) return false;
    const urlLower = url.toLowerCase();
    const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg"];
    return imageExtensions.some((ext) => urlLower.includes(ext));
  }

  // Render document content based on tab type
  function renderDocumentContent(docType) {
    const opportunity = getCurrentOpportunity();
    const displayAreas = document.querySelectorAll("#documentsDisplayArea");
    if (displayAreas.length === 0) return;

    let contentHTML = "";

    if (docType === "contracts") {
      const contracts = opportunity ? opportunity.contracts : null;

      if (contracts && Array.isArray(contracts) && contracts.length > 0) {
        contracts.forEach((contract, index) => {
          const contractName = contract.name || `Contract ${index + 1}`;
          const contractStatus = contract.status || "Unknown";
          const contractPreviewUrl = contract.previewUrl || contract.url || "#";
          const contractPdfLink = contract.pdfLink || contractPreviewUrl;

          let statusColor = CSS_VARS.neutral;
          let statusBg = CSS_VARS.bgMain;

          if (contractStatus.toLowerCase() === "completed" || contractStatus.toLowerCase() === "signed") {
            statusColor = CSS_VARS.success;
            statusBg = CSS_VARS.successBg;
          } else if (contractStatus.toLowerCase() === "declined" || contractStatus.toLowerCase() === "rejected") {
            statusColor = CSS_VARS.error;
            statusBg = CSS_VARS.errorBg;
          } else if (contractStatus.toLowerCase() === "sent" || contractStatus.toLowerCase() === "pending") {
            statusColor = CSS_VARS.warning;
            statusBg = CSS_VARS.warningBg;
          } else if (contractStatus.toLowerCase() === "viewed") {
            statusColor = CSS_VARS.info;
            statusBg = CSS_VARS.infoBg;
          }

          contentHTML += `
            <div style="padding: 0.75rem; border: 1px solid ${CSS_VARS.border}; border-radius: 6px; margin-bottom: 0.5rem; background: white;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <div style="flex: 1;">
                  <div style="font-weight: 600; color: ${CSS_VARS.textDark}; margin-bottom: 0.25rem;">${contractName}</div>
                  <div style="display: inline-block; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 500; color: ${statusColor}; background: ${statusBg};">${contractStatus}</div>
                </div>
                <a href="${contractPreviewUrl}" target="_blank" class="custom-primary-btn" style="margin-right: 0.5rem;">View Contract</a>
                ${contractPdfLink && contractPdfLink !== "#" ? `<a href="${contractPdfLink}" target="_blank" class="custom-secondary-btn">Download PDF</a>` : ""}
              </div>
            </div>
          `;
        });
      } else {
        contentHTML = `<p style="color: ${CSS_VARS.neutral}; font-size: 0.875rem; margin-top: 0.5rem;">No contracts available</p>`;
      }
    } else if (docType === "estimates") {
      const estimates = opportunity ? opportunity.estimates : null;

      if (estimates && Array.isArray(estimates) && estimates.length > 0) {
        estimates.forEach((estimate, index) => {
          const estimateName = estimate.name || `Estimate ${estimate.number || index + 1}`;
          const estimateNumber = estimate.number || estimate.id || "N/A";
          const estimateUrl = estimate.url || "#";

          contentHTML += `
            <div style="padding: 0.75rem; border: 1px solid ${CSS_VARS.border}; border-radius: 6px; margin-bottom: 0.5rem; background: white;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <div style="flex: 1;">
                  <div style="font-weight: 600; color: ${CSS_VARS.textDark}; margin-bottom: 0.25rem;">${estimateName}</div>
                  <div style="font-size: 0.875rem; color: ${CSS_VARS.textSecondary};">Estimate #${estimateNumber}</div>
                </div>
                ${estimateUrl && estimateUrl !== "#" ? `<a href="${estimateUrl}" target="_blank" class="custom-primary-btn">View Estimate</a>` : ""}
              </div>
            </div>
          `;
        });
      } else {
        contentHTML = `<p style="color: ${CSS_VARS.neutral}; font-size: 0.875rem; margin-top: 0.5rem;">No estimates available</p>`;
      }
    } else if (docType === "shared") {
      const sharedFiles = opportunity ? opportunity.shareFiles : null;

      if (sharedFiles && Array.isArray(sharedFiles) && sharedFiles.length > 0) {
        sharedFiles.forEach((file) => {
          const fileName = file.name || "Unnamed File";
          const fileUrl = file.url || "#";
          const fileExtension = fileName.split(".").pop().toLowerCase();

          let fileIcon = "";
          if (["pdf"].includes(fileExtension)) {
            fileIcon = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="${CSS_VARS.secondary}" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><text x="12" y="16" text-anchor="middle" fill="${CSS_VARS.secondary}" font-size="5" font-weight="bold">PDF</text></svg>`;
          } else if (["jpg", "jpeg", "png", "gif", "webp", "bmp"].includes(fileExtension)) {
            fileIcon = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="${CSS_VARS.success}" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`;
          } else if (["doc", "docx"].includes(fileExtension)) {
            fileIcon = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="${CSS_VARS.info}" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>`;
          } else {
            fileIcon = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="${CSS_VARS.neutral}" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>`;
          }

          contentHTML += `
            <div style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; border: 1px solid ${CSS_VARS.border}; border-radius: 6px; margin-bottom: 0.5rem; background: white;">
              <div style="flex-shrink: 0;">${fileIcon}</div>
              <div style="flex: 1; min-width: 0;">
                <div style="font-weight: 500; color: ${CSS_VARS.textDark}; font-size: 0.875rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${fileName}">${fileName}</div>
              </div>
              <a href="${fileUrl}" target="_blank" class="custom-primary-btn" style="flex-shrink: 0;">View</a>
            </div>
          `;
        });
      } else {
        contentHTML = `<p style="color: ${CSS_VARS.neutral}; font-size: 0.875rem; margin-top: 0.5rem;">No shared documents available</p>`;
      }
    }

    displayAreas.forEach((area) => { area.innerHTML = contentHTML; });
  }

  // Initialize document tabs
  function initializeDocumentTabs() {
    const docTabButtons = document.querySelectorAll("[data-doc-type]");

    docTabButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const docType = button.getAttribute("data-doc-type");
        document.querySelectorAll("[data-doc-type]").forEach((btn) => { btn.classList.remove("tab-active"); });
        button.classList.add("tab-active");
        renderDocumentContent(docType);
      });
    });

    setTimeout(() => renderDocumentContent("contracts"), 100);
  }

  // Gallery Tab Functions
  function initializeGalleryTabs() {
    function updateGallery(tabType) {
      currentGalleryType = tabType;
      currentGalleryPage = 0;
      const opportunity = getCurrentOpportunity();

      if (opportunity) {
        const items = tabType === "before" ? opportunity.BeforeImages : opportunity.AfterImages;
        currentGalleryItems = items || [];
        renderGalleryItems(items, tabType);
      } else {
        currentGalleryItems = [];
        renderGalleryItems([], tabType);
      }
      updatePhotoNavigation();
    }

    document.querySelectorAll(".photo-tab-btn").forEach((tab) => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".photo-tab-btn").forEach((t) => t.classList.remove("tab-active"));
        tab.classList.add("tab-active");
        const tabType = tab.getAttribute("data-gallery-type");
        updateGallery(tabType);
      });
    });

    document.querySelectorAll("#photoPrevious").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (currentGalleryPage > 0) {
          currentGalleryPage--;
          renderGalleryItems(currentGalleryItems, currentGalleryType);
          updatePhotoNavigation();
        }
      });
    });

    document.querySelectorAll("#photoNext").forEach((btn) => {
      btn.addEventListener("click", () => {
        const maxPage = Math.ceil(currentGalleryItems.length / galleryItemsPerPage) - 1;
        if (currentGalleryPage < maxPage) {
          currentGalleryPage++;
          renderGalleryItems(currentGalleryItems, currentGalleryType);
          updatePhotoNavigation();
        }
      });
    });

    updateGallery("before");
  }

  function updatePhotoNavigation() {
    const maxPage = Math.ceil(currentGalleryItems.length / galleryItemsPerPage) - 1;

    document.querySelectorAll("#photoPrevious").forEach((btn) => {
      if (currentGalleryPage === 0) {
        btn.classList.add("nav-disabled");
      } else {
        btn.classList.remove("nav-disabled");
      }
    });

    document.querySelectorAll("#photoNext").forEach((btn) => {
      if (currentGalleryPage >= maxPage || currentGalleryItems.length <= galleryItemsPerPage) {
        btn.classList.add("nav-disabled");
      } else {
        btn.classList.remove("nav-disabled");
      }
    });
  }
})();
