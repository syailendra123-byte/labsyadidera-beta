(function () {
  "use strict";

  var modal = document.getElementById("modal");
  var modalImage = document.getElementById("modal-image");
  var mainImage = document.getElementById("main-image");
  var closeBtn = document.getElementById("close-modal");
  var lastFocused = null;

  function openModal() {
    lastFocused = document.activeElement;
    modal.hidden = false;
    requestAnimationFrame(function () {
      modal.classList.add("open");
    });
    document.body.style.overflow = "hidden";
    closeBtn.focus();
  }

  function closeModal() {
    modal.classList.remove("open");
    document.body.style.overflow = "";
    var onEnd = function () {
      if (!modal.classList.contains("open")) {
        modal.hidden = true;
        modalImage.removeAttribute("src");
        modalImage.setAttribute("src", "white.png");
      }
      modal.removeEventListener("transitionend", onEnd);
    };
    modal.addEventListener("transitionend", onEnd);
    if (lastFocused && typeof lastFocused.focus === "function") {
      lastFocused.focus();
    }
  }

  mainImage.addEventListener("click", openModal);

  mainImage.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openModal();
    }
  });

  closeBtn.addEventListener("click", closeModal);

  modal.addEventListener("click", function (e) {
    if (e.target === modal) {
      closeModal();
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !modal.hidden) {
      closeModal();
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Tab" && !modal.hidden) {
      e.preventDefault();
      closeBtn.focus();
    }
  });
})();
