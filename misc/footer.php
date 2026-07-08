<nav class="site-actions" aria-label="Site actions">
  <button class="theme-toggle" type="button" data-theme-toggle aria-label="Switch color theme">☾</button>
</nav>
<footer>
  <a href="https://github.com/Remake0992/Pinternext/" target="_blank" rel="noopener noreferrer">Source code</a>
  <a href="./donate.php" target="_blank" rel="noopener noreferrer">Donate</a>
  <a href="https://github.com/Remake0992/Pinternext#legal-notice" target="_blank" rel="noopener noreferrer">Legal notice</a>
<?php
if (isset($images)) {
  print("<span class='footer-count'>" . count($images) . " images found</span>");
}
?>
</footer>
<script src="/static/theme-toggle.js" defer></script>
<script src="/static/pinternext-library.js?v=2" defer></script>
</body>
</html>