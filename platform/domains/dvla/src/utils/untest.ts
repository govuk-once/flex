export const someUntestedFunction = () => {
  // This function is intentionally left untested for demonstration purposes.
  console.log("This function is not covered by tests.");

  // Call another function that is also untested.
  someCalledFunction();

  // Call a function that uses setTimeout, which is also untested.
  someSetTimeoutFunction();

  console.log("End of untested function.");
};

function someCalledFunction() {
  console.log(
    "This function is called by someUntestedFunction and is also untested.",
  );
}

function someSetTimeoutFunction() {
  setTimeout(() => {
    console.log(
      "This function is called after a timeout and is also untested.",
    );
  }, 1000);
}
