(function() {
    const savedTheme = localStorage.getItem('daynight-theme');
    if (savedTheme === 'carbon') {
        document.documentElement.classList.add('carbon');
        document.body.classList.add('carbon');
    }
})();