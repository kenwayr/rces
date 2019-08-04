var SERVER_CONSTANTS = {};
var SERVER_ERRORS = {};
var SERVER_EVENTS = {};
$.ajax({
    url: 'http://localhost:1337/constants',
    async: false,
    success: function (response) {
        response = JSON.parse(response);
        SERVER_CONSTANTS = response.constants;
        SERVER_ERRORS = response.errors;
        SERVER_EVENTS = response.events;
    }
});