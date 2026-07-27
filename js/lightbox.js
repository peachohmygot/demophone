// Fullscreen photo viewer with pinch-zoom, pan, and swipe between images.
// Built for inspecting scratches and flaws on second-hand phones.

let overlay, imgEl, counterEl, images = [], index = 0;
let scale = 1, tx = 0, ty = 0;
let startDist = 0, startScale = 1;
let panning = false, startX = 0, startY = 0, startTx = 0, startTy = 0;
let swipeStartX = 0, swipeDX = 0, swiping = false;
let lastTap = 0;

const MAX_SCALE = 5;

function build() {
  overlay = document.createElement("div");
  overlay.className = "lb";
  overlay.innerHTML = `
    <button class="lb-close" aria-label="Close">×</button>
    <div class="lb-counter"></div>
    <button class="lb-nav lb-prev" aria-label="Previous">‹</button>
    <img class="lb-img" alt="" draggable="false" />
    <button class="lb-nav lb-next" aria-label="Next">›</button>`;
  document.body.appendChild(overlay);

  imgEl = overlay.querySelector(".lb-img");
  counterEl = overlay.querySelector(".lb-counter");

  overlay.querySelector(".lb-close").onclick = close;
  overlay.querySelector(".lb-prev").onclick = (e) => { e.stopPropagation(); go(-1); };
  overlay.querySelector(".lb-next").onclick = (e) => { e.stopPropagation(); go(1); };

  // Tapping the dark backdrop (not the photo) closes.
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });

  // ---- desktop ----
  overlay.addEventListener("wheel", (e) => {
    e.preventDefault();
    zoomAt(scale * (e.deltaY < 0 ? 1.15 : 1 / 1.15));
  }, { passive: false });

  imgEl.addEventListener("dblclick", (e) => {
    e.preventDefault();
    zoomAt(scale > 1 ? 1 : 2.5);
  });

  imgEl.addEventListener("mousedown", (e) => {
    if (scale <= 1) return;
    e.preventDefault();
    panning = true;
    startX = e.clientX; startY = e.clientY; startTx = tx; startTy = ty;
  });
  window.addEventListener("mousemove", (e) => {
    if (!panning) return;
    tx = startTx + (e.clientX - startX);
    ty = startTy + (e.clientY - startY);
    apply();
  });
  window.addEventListener("mouseup", () => { panning = false; clampPan(); });

  // ---- touch ----
  imgEl.addEventListener("touchstart", (e) => {
    if (e.touches.length === 2) {
      swiping = false;
      startDist = dist(e.touches);
      startScale = scale;
    } else if (e.touches.length === 1) {
      const now = Date.now();
      if (now - lastTap < 300) {          // double-tap to zoom
        zoomAt(scale > 1 ? 1 : 2.5);
        lastTap = 0;
        return;
      }
      lastTap = now;

      if (scale > 1) {
        panning = true;
        startX = e.touches[0].clientX; startY = e.touches[0].clientY;
        startTx = tx; startTy = ty;
      } else {
        swiping = true;
        swipeStartX = e.touches[0].clientX;
        swipeDX = 0;
      }
    }
  }, { passive: true });

  imgEl.addEventListener("touchmove", (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      zoomAt(startScale * (dist(e.touches) / startDist));
    } else if (panning && e.touches.length === 1) {
      e.preventDefault();
      tx = startTx + (e.touches[0].clientX - startX);
      ty = startTy + (e.touches[0].clientY - startY);
      apply();
    } else if (swiping && e.touches.length === 1) {
      swipeDX = e.touches[0].clientX - swipeStartX;
      imgEl.style.transform = `translate(${swipeDX}px,0) scale(1)`;
    }
  }, { passive: false });

  imgEl.addEventListener("touchend", () => {
    if (panning) { panning = false; clampPan(); }
    if (swiping) {
      swiping = false;
      if (Math.abs(swipeDX) > 60) go(swipeDX < 0 ? 1 : -1);
      else apply();
      swipeDX = 0;
    }
  }, { passive: true });

  // ---- keyboard ----
  window.addEventListener("keydown", (e) => {
    if (!overlay.classList.contains("open")) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowRight") go(1);
    if (e.key === "ArrowLeft") go(-1);
  });
}

function dist(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.hypot(dx, dy);
}

function zoomAt(next) {
  const prev = scale;
  scale = Math.min(MAX_SCALE, Math.max(1, next));
  if (scale === 1) { tx = 0; ty = 0; }
  else { tx *= scale / prev; ty *= scale / prev; }
  clampPan();
}

// Keep the photo from being dragged completely off screen.
function clampPan() {
  const maxX = (imgEl.clientWidth * (scale - 1)) / 2;
  const maxY = (imgEl.clientHeight * (scale - 1)) / 2;
  tx = Math.max(-maxX, Math.min(maxX, tx));
  ty = Math.max(-maxY, Math.min(maxY, ty));
  apply();
}

function apply() {
  imgEl.style.transform = `translate(${tx}px,${ty}px) scale(${scale})`;
  imgEl.classList.toggle("zoomed", scale > 1);
}

function show() {
  imgEl.src = images[index];
  scale = 1; tx = 0; ty = 0;
  apply();
  counterEl.textContent = `${index + 1} / ${images.length}`;
  const many = images.length > 1;
  overlay.querySelector(".lb-prev").style.display = many ? "" : "none";
  overlay.querySelector(".lb-next").style.display = many ? "" : "none";
  counterEl.style.display = many ? "" : "none";
}

function go(step) {
  if (images.length < 2) { apply(); return; }
  index = (index + step + images.length) % images.length;
  show();
}

export function openLightbox(urls, startIndex = 0) {
  if (!overlay) build();
  images = urls;
  index = Math.max(0, Math.min(urls.length - 1, startIndex));
  overlay.classList.add("open");
  document.body.style.overflow = "hidden";
  show();
}

function close() {
  overlay.classList.remove("open");
  document.body.style.overflow = "";
}
