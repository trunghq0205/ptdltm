(function () {
  "use strict";

  const body = document.body;
  const gate = document.getElementById("modeGate");
  const reportView = document.getElementById("reportView");
  const presentationView = document.getElementById("presentationView");
  const reportMain = document.getElementById("reportMain");
  const deck = document.getElementById("deck");
  const counter = document.getElementById("deckCounter");
  const progressBar = document.getElementById("deckProgressBar");
  const previousButton = document.getElementById("prevSlide");
  const nextButton = document.getElementById("nextSlide");
  const fullscreenButton = document.getElementById("fullscreenToggle");

  let slides = [];
  let activeSlide = 0;
  let deckBuilt = false;
  let wheelLocked = false;
  let touchStartX = 0;
  let touchStartY = 0;

  body.classList.add("mode-picker-open");

  function cleanClone(node) {
    const clone = node.cloneNode(true);
    if (clone.id) clone.removeAttribute("id");
    clone.querySelectorAll("[id]").forEach((element) => element.removeAttribute("id"));
    clone.querySelectorAll("a[href^='#']").forEach((link) => link.removeAttribute("href"));
    return clone;
  }

  function createSlide({ title, section, nodes = [], kind = "content", sectionIndex = "", accent = "#8c2f45" }) {
    const slide = document.createElement("section");
    slide.className = `deck-slide deck-slide--${kind}`;
    slide.setAttribute("aria-hidden", "true");
    slide.style.setProperty("--slide-accent", accent);
    if (sectionIndex) slide.dataset.index = sectionIndex;

    const inner = document.createElement("div");
    inner.className = "deck-slide__inner";

    if (kind === "hero") {
      nodes.forEach((node) => inner.appendChild(cleanClone(node)));
    } else {
      if (section) {
        const label = document.createElement("div");
        label.className = "deck-slide__section";
        label.textContent = section;
        inner.appendChild(label);
      }
      if (title) {
        const heading = document.createElement("h2");
        heading.className = "deck-slide__title";
        heading.innerHTML = title;
        inner.appendChild(heading);
      }
      if (nodes.length) {
        const scroll = document.createElement("div");
        scroll.className = "deck-slide__scroll";
        const content = document.createElement("div");
        content.className = "deck-slide__content";
        nodes.forEach((node) => content.appendChild(cleanClone(node)));
        scroll.appendChild(content);
        inner.appendChild(scroll);
      }
    }
    slide.appendChild(inner);
    deck.appendChild(slide);
  }

  function nodeWeight(node) {
    if (node.matches("h3")) return 0.8;
    if (node.matches("figure,.tbl-scroll")) return 8;
    if (node.matches(".callout")) return 6;
    if (node.matches(".cards")) return 5;
    if (node.matches(".formula,.q")) return 3;
    if (node.matches("ul,ol")) return Math.max(2, node.querySelectorAll(":scope > li").length * 1.35);
    const words = (node.textContent.trim().match(/\S+/g) || []).length;
    return Math.max(1, words / 62);
  }

  function splitIntoChunks(nodes) {
    const chunks = [];
    let chunk = [];
    let weight = 0;
    const limit = 11.5;

    nodes.forEach((node) => {
      const value = nodeWeight(node);
      const keepWithNext = (node.matches(".tcap") && node.nextElementSibling && node.nextElementSibling.matches(".tbl-scroll")) || node.matches("h3");
      if (chunk.length && weight + value > limit && !chunk[chunk.length - 1].matches(".tcap,h3")) {
        chunks.push(chunk);
        chunk = [];
        weight = 0;
      }
      chunk.push(node);
      weight += value;
      if (value >= limit && !keepWithNext) {
        chunks.push(chunk);
        chunk = [];
        weight = 0;
      }
    });
    if (chunk.length) chunks.push(chunk);
    return chunks;
  }

  function headingText(heading) {
    const clone = heading.cloneNode(true);
    clone.querySelectorAll(".n").forEach((node) => node.remove());
    return clone.innerHTML.trim();
  }

  function buildDeck() {
    if (deckBuilt) return;
    const titleBlock = reportMain.querySelector("header.titleblock");
    createSlide({ nodes: [titleBlock], kind: "hero" });

    const children = Array.from(reportMain.children).filter((node) => node !== titleBlock);
    const sectionColors = ["#8c2f45", "#315f9d", "#39745b", "#7a4c99", "#ad6337", "#48647f"];
    let currentSection = "Mở đầu";
    let currentSectionIndex = "§";
    let currentTitle = "Tổng quan nghiên cứu";
    let currentNodes = [];
    let sectionNumber = -1;

    function flushGroup() {
      if (!currentNodes.length) return;
      const chunks = splitIntoChunks(currentNodes);
      chunks.forEach((chunk, index) => {
        createSlide({
          title: `${currentTitle}${index ? " <small>· tiếp theo</small>" : ""}`,
          section: currentSection,
          nodes: chunk,
          accent: sectionColors[Math.max(0, sectionNumber) % sectionColors.length]
        });
      });
      currentNodes = [];
    }

    children.forEach((node) => {
      if (node.tagName === "H2") {
        flushGroup();
        sectionNumber += 1;
        currentSection = headingText(node);
        currentSectionIndex = node.querySelector(".n")?.textContent.trim() || String(sectionNumber + 1).padStart(2, "0");
        currentTitle = currentSection;
      } else {
        currentNodes.push(node);
      }
    });
    flushGroup();

    slides = Array.from(deck.querySelectorAll(".deck-slide"));
    slides.forEach((slide, index) => {
      slide.dataset.slide = String(index + 1);
      slide.setAttribute("aria-label", `Slide ${index + 1} trên ${slides.length}`);
      slide.querySelectorAll("img").forEach((image) => {
        image.addEventListener("error", () => image.closest(".figbox")?.classList.add("image-missing"));
      });
    });
    deckBuilt = true;
    showSlide(0, false);
  }

  function showSlide(index, animate = true) {
    if (!slides.length) return;
    activeSlide = Math.min(Math.max(index, 0), slides.length - 1);
    slides.forEach((slide, slideIndex) => {
      slide.classList.toggle("is-active", slideIndex === activeSlide);
      slide.classList.toggle("is-before", slideIndex < activeSlide);
      slide.setAttribute("aria-hidden", String(slideIndex !== activeSlide));
      if (slideIndex === activeSlide) {
        const scroller = slide.querySelector(".deck-slide__scroll");
        if (scroller) scroller.scrollTop = 0;
      }
    });
    if (!animate) deck.classList.add("no-transition");
    requestAnimationFrame(() => deck.classList.remove("no-transition"));
    const digits = String(slides.length).length;
    counter.textContent = `${String(activeSlide + 1).padStart(digits, "0")} / ${String(slides.length).padStart(digits, "0")}`;
    progressBar.style.width = `${((activeSlide + 1) / slides.length) * 100}%`;
    previousButton.disabled = activeSlide === 0;
    nextButton.disabled = activeSlide === slides.length - 1;
  }

  function setMode(mode) {
    if (mode === "present") buildDeck();
    body.classList.remove("mode-picker-open", "mode-report", "mode-present");
    body.classList.add("mode-selected", `mode-${mode}`);
    reportView.setAttribute("aria-hidden", String(mode !== "report"));
    presentationView.setAttribute("aria-hidden", String(mode !== "present"));
    if (mode === "present") showSlide(activeSlide, false);
    if (mode === "report") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function stepSlide(direction) {
    showSlide(activeSlide + direction);
  }

  gate.querySelectorAll("[data-mode]").forEach((button) => button.addEventListener("click", () => setMode(button.dataset.mode)));
  document.querySelectorAll("[data-switch]").forEach((button) => button.addEventListener("click", () => setMode(button.dataset.switch)));
  previousButton.addEventListener("click", () => stepSlide(-1));
  nextButton.addEventListener("click", () => stepSlide(1));

  document.addEventListener("keydown", (event) => {
    if (!body.classList.contains("mode-present") || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
    if (["ArrowRight", "ArrowDown", "PageDown", " "].includes(event.key)) {
      event.preventDefault();
      stepSlide(1);
    } else if (["ArrowLeft", "ArrowUp", "PageUp"].includes(event.key)) {
      event.preventDefault();
      stepSlide(-1);
    } else if (event.key === "Home") {
      event.preventDefault();
      showSlide(0);
    } else if (event.key === "End") {
      event.preventDefault();
      showSlide(slides.length - 1);
    }
  });

  presentationView.addEventListener("wheel", (event) => {
    if (wheelLocked || Math.abs(event.deltaY) < 28) return;
    const scroller = slides[activeSlide]?.querySelector(".deck-slide__scroll");
    const canScrollDown = scroller && scroller.scrollTop + scroller.clientHeight < scroller.scrollHeight - 2;
    const canScrollUp = scroller && scroller.scrollTop > 2;
    if ((event.deltaY > 0 && canScrollDown) || (event.deltaY < 0 && canScrollUp)) return;
    event.preventDefault();
    wheelLocked = true;
    stepSlide(event.deltaY > 0 ? 1 : -1);
    window.setTimeout(() => { wheelLocked = false; }, 650);
  }, { passive: false });

  presentationView.addEventListener("touchstart", (event) => {
    touchStartX = event.changedTouches[0].screenX;
    touchStartY = event.changedTouches[0].screenY;
  }, { passive: true });
  presentationView.addEventListener("touchend", (event) => {
    const dx = event.changedTouches[0].screenX - touchStartX;
    const dy = event.changedTouches[0].screenY - touchStartY;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy)) stepSlide(dx < 0 ? 1 : -1);
  }, { passive: true });

  fullscreenButton.addEventListener("click", async () => {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch (_) {
      fullscreenButton.title = "Trình duyệt không cho phép toàn màn hình";
    }
  });
  document.addEventListener("fullscreenchange", () => {
    fullscreenButton.textContent = document.fullscreenElement ? "×" : "⛶";
    fullscreenButton.setAttribute("aria-label", document.fullscreenElement ? "Thoát toàn màn hình" : "Bật toàn màn hình");
  });
})();
