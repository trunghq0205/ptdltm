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
  let touchStartX = 0;
  let touchStartY = 0;
  let controlsHideTimer = 0;

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
        const titleLength = heading.textContent.trim().length;
        if (titleLength > 42) heading.classList.add("is-long");
        if (titleLength > 68) heading.classList.add("is-very-long");
        inner.appendChild(heading);
      }
      if (nodes.length) {
        const scroll = document.createElement("div");
        scroll.className = "deck-slide__scroll";
        const content = document.createElement("div");
        content.className = "deck-slide__content";
        nodes
          .filter((node) => !node.matches("h3"))
          .forEach((node) => content.appendChild(cleanClone(node)));
        scroll.appendChild(content);
        inner.appendChild(scroll);
      }
    }
    slide.appendChild(inner);
    deck.appendChild(slide);
  }

  function nodeWeight(node) {
    if (node.matches("h3")) return 0.7;
    if (node.matches("figure,.tbl-scroll")) return 9.5;
    if (node.matches(".callout")) return 7.5;
    if (node.matches(".cards")) return 6;
    if (node.matches(".formula,.q")) return 3.5;
    if (node.matches("ul,ol")) {
      const items = node.querySelectorAll(":scope > li").length;
      const words = (node.textContent.trim().match(/\S+/g) || []).length;
      return Math.max(2, items * 1.35 + words / 105);
    }
    const words = (node.textContent.trim().match(/\S+/g) || []).length;
    return Math.max(1, words / 50);
  }

  function splitList(list, maxItems = 3, maxWords = 115) {
    const items = Array.from(list.querySelectorAll(":scope > li"));
    if (items.length <= maxItems && (list.textContent.match(/\S+/g) || []).length <= maxWords) return [list];
    const parts = [];
    let partItems = [];
    let partWords = 0;
    let partStart = 0;

    function flushPart() {
      if (!partItems.length) return;
      const part = list.cloneNode(false);
      if (part.tagName === "OL") {
        const originalStart = Number(list.getAttribute("start")) || 1;
        part.setAttribute("start", originalStart + partStart);
      }
      partItems.forEach((item) => part.appendChild(item.cloneNode(true)));
      parts.push(part);
      partStart += partItems.length;
      partItems = [];
      partWords = 0;
    }

    items.forEach((item) => {
      const words = (item.textContent.match(/\S+/g) || []).length;
      if (partItems.length && (partItems.length >= maxItems || partWords + words > maxWords)) flushPart();
      partItems.push(item);
      partWords += words;
    });
    flushPart();
    return parts;
  }

  function normalizeSlideNodes(nodes) {
    const normalized = [];
    nodes.forEach((node) => {
      if (node.matches("ul,ol")) {
        normalized.push(...splitList(node, node.matches(".slide-concise") ? 5 : 3, node.matches(".slide-concise") ? 150 : 115));
        return;
      }
      if (node.matches(".callout")) {
        const list = node.querySelector(":scope > ul, :scope > ol");
        if (list) {
          const parts = splitList(list, 3, 105);
          if (parts.length > 1) {
            const lastPart = parts[parts.length - 1];
            const previousPart = parts[parts.length - 2];
            if (lastPart.children.length === 1 && previousPart.children.length > 2) {
              lastPart.insertBefore(previousPart.lastElementChild, lastPart.firstElementChild);
            }
          }
          if (parts.length > 1) {
            parts.forEach((part, index) => {
              const callout = node.cloneNode(false);
              const label = node.querySelector(":scope > .lbl");
              if (label) {
                const labelClone = label.cloneNode(true);
                if (index) labelClone.textContent += " · tiếp theo";
                callout.appendChild(labelClone);
              }
              callout.appendChild(part);
              normalized.push(callout);
            });
            return;
          }
        }
      }
      normalized.push(node);
    });
    return normalized;
  }

  function splitIntoChunks(nodes) {
    const chunks = [];
    let chunk = [];
    let weight = 0;
    const limit = 8.8;

    normalizeSlideNodes(nodes).forEach((node) => {
      const value = nodeWeight(node);
      const keepWithNext = (node.matches(".tcap") && node.nextElementSibling && node.nextElementSibling.matches(".tbl-scroll")) || node.matches("h3");
      if (node.matches("h3") && chunk.length) {
        chunks.push(chunk);
        chunk = [];
        weight = 0;
      }
      if (node.matches(".slide-break-before") && chunk.length) {
        chunks.push(chunk);
        chunk = [];
        weight = 0;
      }
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

  function escapeTitle(text) {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function chunkTitle(chunk, topicTitle) {
    const customTitle = chunk.find((node) => node.dataset.slideTitle);
    if (customTitle) return escapeTitle(customTitle.dataset.slideTitle);

    const subsection = chunk.find((node) => node.matches("h3"));
    if (subsection) return escapeTitle(subsection.textContent.trim());

    const tableCaption = chunk.find((node) => node.matches(".tcap"));
    if (tableCaption) return escapeTitle(tableCaption.textContent.trim());

    const figure = chunk.find((node) => node.matches("figure"));
    const figureTitle = figure?.querySelector("figcaption > b, figcaption strong");
    if (figureTitle) return escapeTitle(figureTitle.textContent.trim());

    const calloutLabel = chunk
      .find((node) => node.matches(".callout"))
      ?.querySelector(":scope > .lbl");
    if (calloutLabel) {
      return `${topicTitle} <small>· ${escapeTitle(calloutLabel.textContent.trim())}</small>`;
    }

    return topicTitle;
  }

  // Phiên bản rút gọn chỉ dùng cho slide của Mục III. Nội dung báo cáo đầy đủ
  // không bị thay đổi; khi dựng deck, các đoạn dài được thay bằng bullet ngắn.
  const DML_CONCISE = {
    intro: [
      "<b>DML</b>: kết hợp học máy (khử nhiễu phi tuyến từ biến kiểm soát) với một bước ước lượng nhân quả ở cuối.",
      "<b>Bước 1</b> (khử nhiễu): dùng LightGBM dự đoán riêng <i>giá</i> và <i>từng yếu tố</i> từ biến kiểm soát <i>W</i> (diện tích, số phòng, toilet, tầng, khu vực), rồi lấy phần dư.",
      "<b>Bước 2</b>: hồi quy phần dư của giá lên phần dư của các yếu tố → hệ số <i>θ̂</i> ≈ tác động nhân quả riêng của từng yếu tố.",
      "Quy đổi sang %: (e<sup><i>θ̂</i></sup> − 1) × 100.",
      "Triển khai <b>4 mô hình</b> theo nguyên lý này, chia thành 2 nhóm theo mục đích."
    ],
    "A. LinearDML": [
      "<b>Mô hình trục chính</b> — ước lượng đồng thời hiệu ứng riêng phần của cả 5 yếu tố.",
      "5 yếu tố đưa vào cùng một vector tác nhân <i>T</i>; khử nhiễu bằng LightGBM (5-fold cross-fitting).",
      "Bước cuối: hồi quy tuyến tính (OLS) trên phần dư.",
      "Mỗi hệ số = chênh lệch giá/m² giữa hai căn giống hệt nhau, chỉ khác một yếu tố."
    ],
    "B. SparseLinearDML": [
      "<b>Mô hình đối chứng</b> — cùng dữ liệu &amp; cách khử nhiễu như LinearDML.",
      "Chỉ khác bước cuối: dùng <i>debiased Lasso</i> thay cho OLS.",
      "Mục đích: xử lý đa cộng tuyến khi các yếu tố tương quan, vẫn giữ p-value &amp; khoảng tin cậy hợp lệ.",
      "Hệ số trùng LinearDML → kết quả <b>vững</b>, không phải giả do đa cộng tuyến."
    ],
    "C. Causal Forest": [
      "Khảo sát chuyên sâu riêng cho <b>yếu tố vị trí</b> (kỳ vọng tác động mạnh nhất).",
      "Ước lượng ATE của việc gần metro bằng rừng cây “honest” (5-fold cross-fitting).",
      "Cho phép hiệu ứng thay đổi theo từng căn (vd: căn nhỏ hưởng lợi nhiều hơn căn lớn).",
      "Giả định: không còn nhiễu quan trọng chưa kiểm soát (<i>unconfoundedness</i>)."
    ],
    "D. Hồi quy gián đoạn (RDD)": [
      "Kiểm chứng độc lập thứ hai cho <b>vị trí</b>.",
      "Ngưỡng 800m tạo “gián đoạn sắc nét” tự nhiên (sharp RDD).",
      "Hồi quy tuyến tính cục bộ hai bên ngưỡng; hệ số <i>β</i> = hiệu ứng cục bộ tại ngưỡng.",
      "Giả định nhẹ hơn: chỉ cần tính liên tục quanh ngưỡng — góc nhìn khác hẳn Causal Forest.",
      "Lặp lại với nhiều bandwidth để kiểm tra độ ổn định."
    ],
    synth: [
      "Đối chiếu trong từng nhóm — <b>A ↔ B</b> và <b>C ↔ D</b> — để kiểm tra độ vững.",
      "Các phương pháp giả định khác nhau cùng kết luận → độ tin cậy được củng cố.",
      "Chi tiết cấu hình, số liệu và bảng biểu ở <b>Mục IV</b>."
    ]
  };

  function conciseList(items, slideTitle = "") {
    const list = document.createElement("ul");
    list.className = "slide-concise";
    if (slideTitle) list.dataset.slideTitle = slideTitle;
    items.forEach((html) => {
      const item = document.createElement("li");
      item.innerHTML = html;
      list.appendChild(item);
    });
    return list;
  }

  function deckChildren(children) {
    const output = [];
    let inMethodSection = false;
    let introAdded = false;

    children.forEach((node) => {
      if (node.tagName === "H2") {
        if (inMethodSection) output.push(conciseList(DML_CONCISE.synth, "Tổng hợp bốn mô hình"));
        inMethodSection = /phương pháp/i.test(node.textContent);
        introAdded = false;
        output.push(node);
        return;
      }

      if (!inMethodSection) {
        output.push(node);
        return;
      }

      if (node.tagName === "H3") {
        output.push(node);
        const conciseContent = DML_CONCISE[node.textContent.trim()];
        if (conciseContent) output.push(conciseList(conciseContent));
        return;
      }

      if (node.matches("p")) {
        if (!introAdded) {
          output.push(conciseList(DML_CONCISE.intro, "Double Machine Learning: ý tưởng cốt lõi"));
          introAdded = true;
        }
        return;
      }

      output.push(node);
    });

    if (inMethodSection) output.push(conciseList(DML_CONCISE.synth, "Tổng hợp bốn mô hình"));
    return output;
  }

  function buildDeck() {
    if (deckBuilt) return;
    const titleBlock = reportMain.querySelector("header.titleblock");
    createSlide({ nodes: [titleBlock], kind: "hero" });

    const children = deckChildren(Array.from(reportMain.children).filter((node) => node !== titleBlock));
    const sectionColors = ["#8c2f45", "#315f9d", "#39745b", "#7a4c99", "#ad6337", "#48647f"];
    let currentSection = "Mở đầu";
    let currentSectionIndex = "§";
    let currentTitle = "Tổng quan nghiên cứu";
    let currentNodes = [];
    let sectionNumber = -1;

    function flushGroup() {
      if (!currentNodes.length) return;
      const chunks = splitIntoChunks(currentNodes);
      let topicTitle = currentTitle;
      chunks.forEach((chunk) => {
        const subsection = chunk.find((node) => node.matches("h3"));
        if (subsection) topicTitle = escapeTitle(subsection.textContent.trim());
        createSlide({
          title: chunkTitle(chunk, topicTitle),
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
    const slideNumberDigits = String(slides.length).length;
    slides.forEach((slide, index) => {
      slide.dataset.slide = String(index + 1);
      slide.setAttribute("aria-label", `Slide ${index + 1} trên ${slides.length}`);
      const pageNumber = document.createElement("div");
      pageNumber.className = "deck-slide__number";
      pageNumber.setAttribute("aria-hidden", "true");
      pageNumber.textContent = `${String(index + 1).padStart(slideNumberDigits, "0")} / ${String(slides.length).padStart(slideNumberDigits, "0")}`;
      slide.appendChild(pageNumber);
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

  function revealControls() {
    body.classList.remove("controls-hidden");
    window.clearTimeout(controlsHideTimer);
    if (document.fullscreenElement && body.classList.contains("mode-present")) {
      controlsHideTimer = window.setTimeout(() => body.classList.add("controls-hidden"), 1800);
    }
  }

  gate.querySelectorAll("[data-mode]").forEach((button) => button.addEventListener("click", () => setMode(button.dataset.mode)));
  document.querySelectorAll("[data-switch]").forEach((button) => button.addEventListener("click", () => setMode(button.dataset.switch)));
  previousButton.addEventListener("click", () => stepSlide(-1));
  nextButton.addEventListener("click", () => stepSlide(1));

  document.addEventListener("keydown", (event) => {
    if (!body.classList.contains("mode-present") || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
    revealControls();
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

  presentationView.addEventListener("touchstart", (event) => {
    revealControls();
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
    revealControls();
  });
  presentationView.addEventListener("pointermove", revealControls, { passive: true });
  presentationView.addEventListener("pointerdown", revealControls, { passive: true });
})();
