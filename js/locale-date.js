var options = { year: 'numeric', month: 'short', day: 'numeric'};
var releaseDateArray = document.getElementsByName('locale-date');
var i = releaseDateArray.length;
while (i--) releaseDateArray[i].innerHTML = new Date(releaseDateArray[i].innerHTML).toLocaleDateString("ko-KR", options);