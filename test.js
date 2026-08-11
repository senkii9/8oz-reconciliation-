const { JSDOM } = require("jsdom");
const dom = new JSDOM(`
  <div class="animate-fade-in">
    <form>
      <div id="first-div-in-form">A</div>
    </form>
  </div>
`);
const el = dom.window.document.querySelector("div.animate-fade-in > div:nth-of-type(1)");
console.log(el ? el.id : "null");
