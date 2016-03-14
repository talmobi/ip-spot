console.log("app js loaded");

var inputEl = document.getElementById('search');
var submitEl = document.getElementById('form');

function handleError () {
  //inputEl.value = "";
};

submitEl.onsubmit = function (e) {
  e.preventDefault();
  console.log("looking up: " + inputEl.value);

  var val = inputEl.value;
  var hostname = val.substring();
  var ind = hostname.indexOf('/');
  if (ind > 0) {
    hostname = val.substring(0, ind);
  }

  var xhr = new XMLHttpRequest();
  xhr.open('GET', '/api/' + hostname, true);
  xhr.onload = function () {
    if (xhr.status >= 200 && xhr.status < 400) {
      // success
      window.location.reload();
    } else {
      // server reached, but error
      handleError();
    }
  };

  xhr.onerror = handleError;

  xhr.send();
};

inputEl.focus();
