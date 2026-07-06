<footer>
  <a href="https://github.com/Remake0992/Pinternext/" target="_blank" rel="noopener noreferrer">Source code</a>
  <a href="./donate.php" target="_blank" rel="noopener noreferrer">Donate</a>
  <a href="https://github.com/Remake0992/Pinternext#legal-notice" target="_blank" rel="noopener noreferrer">Legal notice</a>
  <button class="theme-toggle" type="button" data-theme-toggle aria-label="Switch color theme">Theme</button>
<?php
if (isset($images)) {
  print("<span class='footer-count'>" . count($images) . " images found</span>");
}
?>
</footer>
<script src="/static/theme-toggle.js" defer></script>
</body>
</html>