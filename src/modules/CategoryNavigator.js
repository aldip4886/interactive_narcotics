export class CategoryNavigator {
  constructor(categories, hotspots, { onCategoryClick, onHotspotClick }) {
    this.categories      = categories;
    this.hotspots        = hotspots;
    this.onCategoryClick = onCategoryClick || (() => {});
    this.onHotspotClick  = onHotspotClick  || (() => {});
    this.visited         = new Set();
    this.currentCatId    = 'all';
    this._bindEvents();
  }

  _bindEvents() {
    // 1. Left Sidebar category pills
    const pills = document.querySelectorAll('.cat-pill');
    pills.forEach(pill => {
      pill.addEventListener('click', () => {
        pills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        const catId = pill.dataset.catId;
        this.currentCatId = catId;
        this.onCategoryClick(catId);
      });
    });

    // 2. Right panel overview cards
    const cards = document.querySelectorAll('.overview-card');
    cards.forEach(card => {
      card.addEventListener('click', () => {
        const hsId  = card.dataset.hsId;
        const catId = card.dataset.catId;

        // Activate corresponding left pill
        pills.forEach(p => {
          if (p.dataset.catId === catId) {
            pills.forEach(other => other.classList.remove('active'));
            p.classList.add('active');
          }
        });

        if (hsId) {
          this.onHotspotClick(hsId);
        } else if (catId) {
          this.onCategoryClick(catId);
        }
      });
    });
  }

  markVisited(id) {
    this.visited.add(id);
    this._updateGlobalProgress();
  }

  setActive(id) {
    const hs = this.hotspots.find(h => h.id === id);
    if (!hs) return;

    // Highlight left pill
    const pills = document.querySelectorAll('.cat-pill');
    pills.forEach(p => {
      p.classList.toggle('active', p.dataset.catId === hs.categoryId);
    });

    // Highlight right card
    const cards = document.querySelectorAll('.overview-card');
    cards.forEach(c => {
      const match = (c.dataset.catId === hs.categoryId) || (c.dataset.hsId === id);
      c.style.borderColor = match ? 'var(--navy-dark)' : '';
      c.style.background  = match ? '#f0f5fa' : '';
    });
  }

  _updateGlobalProgress() {
    const total = this.hotspots.length;
    const done  = this.visited.size;
    const progText = document.getElementById('progress-text');
    if (progText) {
      progText.textContent = `${done} / ${total} Titik`;
    }
    const progFill = document.getElementById('progress-bar-fill');
    if (progFill) {
      const pct = (done / total) * 100;
      progFill.style.width = pct + '%';
    }
  }

  get allVisited() {
    return this.visited.size >= this.hotspots.length;
  }
}

