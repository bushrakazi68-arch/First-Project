let statuses = ["placed", "preparing", "out", "delivered"];
let currentIndex = 0;

function updateTracker() {
  document.querySelectorAll(".step").forEach(step => {
    step.classList.remove("active");
  });

  document.getElementById(`step-${statuses[currentIndex]}`)
    .classList.add("active");
}

function simulateNext() {
  if (currentIndex < statuses.length - 1) {
    currentIndex++;
    updateTracker();
  } else {
    alert("Order Delivered!");
  }
}

// initial load
updateTracker();