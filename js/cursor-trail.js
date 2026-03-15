(() => {
  const finePointer = window.matchMedia("(pointer: fine)").matches;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!finePointer || reduceMotion) return;

  const trail = document.querySelector(".cursor-trail");
  const lead = document.querySelector(".cursor-trail__lead");
  const canvas = document.querySelector(".cursor-trail__canvas");
  if (!trail || !lead || !canvas) return;

  document.body.classList.add("trail-cursor-enabled");

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const history = [];
  const trailDuration = 550;
  const visibleTrailDuration = 280;
  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let isVisible = false;

  const resizeCanvas = () => {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.floor(window.innerWidth * ratio);
    canvas.height = Math.floor(window.innerHeight * ratio);
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  };

  const pushPoint = (x, y, time) => {
    history.push({ x, y, time });
    while (history.length > 0 && time - history[0].time > trailDuration + 120) {
      history.shift();
    }
  };

  const render = (now) => {
    pushPoint(mouseX, mouseY, now);
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    if (isVisible) {
      lead.style.transform = `translate(${mouseX}px, ${mouseY}px)`;
      const points = history.filter((point) => now - point.time <= visibleTrailDuration);
      if (points.length > 1) {
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        for (let i = 1; i < points.length; i += 1) {
          const prev = points[i - 1];
          const current = points[i];
          const ageRatio = i / (points.length - 1);
          const alpha = 0.03 + ageRatio * 0.2;
          const width = 2.2 + ageRatio * 1.8;

          ctx.strokeStyle = `rgba(214, 144, 171, ${alpha})`;
          ctx.lineWidth = width;
          ctx.beginPath();
          ctx.moveTo(prev.x, prev.y);
          ctx.lineTo(current.x, current.y);
          ctx.stroke();
        }
      }
    }

    requestAnimationFrame(render);
  };

  window.addEventListener("mousemove", (event) => {
    mouseX = event.clientX;
    mouseY = event.clientY;
    if (!isVisible) {
      isVisible = true;
      trail.classList.add("is-visible");
    }
  });

  window.addEventListener("mousedown", () => {
    trail.classList.add("is-pressed");
  });

  window.addEventListener("mouseup", () => {
    trail.classList.remove("is-pressed");
  });

  document.addEventListener("mouseleave", () => {
    isVisible = false;
    trail.classList.remove("is-visible", "is-pressed");
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  });

  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();
  requestAnimationFrame(render);
})();
