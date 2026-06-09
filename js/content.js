(function () {
  "use strict";

  /**
   * Fetches FAQ data and renders an accessible accordion into the DOM.
   */
  async function loadFAQ() {
    const container = document.getElementById("faq-accordion");
    if (!container) return;

    try {
      const response = await fetch("data/faq.json");
      if (!response.ok) {
        throw new Error(`Failed to load FAQ: ${response.status}`);
      }
      const items = await response.json();
      renderFAQ(container, items);
    } catch (error) {
      console.warn("FAQ could not be loaded.", error);
    }
  }

  /**
   * Renders FAQ items as a details/summary accordion.
   * @param {HTMLElement} container - The target container element.
   * @param {Array<{question: string, answer: string}>} items - FAQ data array.
   */
  function renderFAQ(container, items) {
    const fragment = document.createDocumentFragment();

    for (const item of items) {
      const details = document.createElement("details");
      details.className = "faq__item";

      const summary = document.createElement("summary");
      summary.className = "faq__question";
      summary.textContent = item.question;

      const answer = document.createElement("div");
      answer.className = "faq__answer";
      answer.innerHTML = item.answer;

      details.appendChild(summary);
      details.appendChild(answer);
      fragment.appendChild(details);
    }

    container.appendChild(fragment);
  }

  if (document.readyState === "complete") {
    loadFAQ();
  } else {
    window.addEventListener("load", loadFAQ, { once: true });
  }
})();
