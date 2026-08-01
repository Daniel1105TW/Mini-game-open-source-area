/**
 * Renderer — 2.5D Perspective Canvas with Roll Note Visuals & Touch Lanes
 */
class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = 0;
    this.height = 0;
    this.particles = [];

    this.laneColors = [
      '#00f5d4','#3a86ff','#f72585','#ffee32','#7b2cbf','#ff9e00'
    ];

    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  _resize() {
    this.width = window.innerWidth;
    this.height = Math.max(200, window.innerHeight - 56); // minus header
    this.canvas.width = this.width;
    this.canvas.height = this.height;
  }

  _rrect(x, y, w, h, r) {
    const ctx = this.ctx;
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x+w, y, x+w, y+h, r);
    ctx.arcTo(x+w, y+h, x, y+h, r);
    ctx.arcTo(x, y+h, x, y, r);
    ctx.arcTo(x, y, x+w, y, r);
    ctx.closePath();
  }

  _trackGeom() {
    const cx = this.width / 2;
    const topW = Math.min(this.width * 0.32, 300);
    const botW = Math.min(this.width * 0.68, 700);
    const topY = this.height * 0.12;
    const botY = this.height * 0.88;
    return {
      topL: cx - topW/2, topR: cx + topW/2,
      botL: cx - botW/2, botR: cx + botW/2,
      topY, botY, cx
    };
  }

  _lanePos(lane, laneCount, progress, g) {
    const y = g.topY + progress * (g.botY - g.topY);
    const curL = g.topL + progress * (g.botL - g.topL);
    const curR = g.topR + progress * (g.botR - g.topR);
    const lw = (curR - curL) / laneCount;
    const x = curL + lane * lw;
    return { y, xL: x, xR: x + lw, xC: x + lw/2, lw };
  }

  render(gameState, settings, keyStates) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    const laneCount = settings.laneCount || 4;
    const scrollSpeed = settings.scrollSpeed || 1.8;
    const g = this._trackGeom();

    this._drawTrack(g, laneCount, keyStates);
    this._drawJudgeLine(g, laneCount, keyStates);

    if (gameState.chart?.notes) {
      this._drawNotes(gameState, g, laneCount, scrollSpeed, settings.noteMode || 'standard');
    }

    this._drawParticles();
  }

  _drawTrack(g, laneCount, keyStates) {
    const ctx = this.ctx;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(g.topL, g.topY); ctx.lineTo(g.topR, g.topY);
    ctx.lineTo(g.botR, g.botY); ctx.lineTo(g.botL, g.botY);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, g.topY, 0, g.botY);
    grad.addColorStop(0, 'rgba(8,6,22,0.35)');
    grad.addColorStop(1, 'rgba(20,14,48,0.82)');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(140,80,255,0.55)';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#9d4edd'; ctx.shadowBlur = 14;
    ctx.stroke();
    ctx.restore();

    // Lane dividers + key-press beam
    for (let i = 0; i <= laneCount; i++) {
      const tX = g.topL + (i/laneCount) * (g.topR - g.topL);
      const bX = g.botL + (i/laneCount) * (g.botR - g.botL);

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(tX, g.topY); ctx.lineTo(bX, g.botY);
      ctx.strokeStyle = (i===0||i===laneCount) ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.08)';
      ctx.lineWidth = (i===0||i===laneCount) ? 2 : 1;
      ctx.stroke();
      ctx.restore();

      if (i < laneCount && keyStates?.[i]) {
        const tX2 = g.topL + ((i+1)/laneCount) * (g.topR - g.topL);
        const bX2 = g.botL + ((i+1)/laneCount) * (g.botR - g.botL);
        const col = this.laneColors[i % this.laneColors.length];
        const bg = ctx.createLinearGradient(0, g.topY, 0, g.botY);
        bg.addColorStop(0, 'rgba(0,0,0,0)');
        bg.addColorStop(0.65, col + '28');
        bg.addColorStop(1, col + '70');
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(tX, g.topY); ctx.lineTo(tX2, g.topY);
        ctx.lineTo(bX2, g.botY); ctx.lineTo(bX, g.botY);
        ctx.closePath();
        ctx.fillStyle = bg;
        ctx.fill();
        ctx.restore();
      }
    }
  }

  _drawJudgeLine(g, laneCount, keyStates) {
    const ctx = this.ctx;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(g.botL - 16, g.botY); ctx.lineTo(g.botR + 16, g.botY);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.shadowColor = '#00f5d4'; ctx.shadowBlur = 22;
    ctx.stroke();
    ctx.restore();

    for (let i = 0; i < laneCount; i++) {
      const pos = this._lanePos(i, laneCount, 1.0, g);
      const col = this.laneColors[i % this.laneColors.length];
      const pressed = keyStates?.[i];

      ctx.save();
      ctx.beginPath();
      ctx.ellipse(pos.xC, g.botY, pos.lw * 0.4, 7, 0, 0, Math.PI*2);
      if (pressed) {
        ctx.fillStyle = col;
        ctx.shadowColor = col; ctx.shadowBlur = 28;
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.strokeStyle = col; ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      ctx.fill();
      ctx.restore();
    }
  }

  _drawNotes(gameState, g, laneCount, scrollSpeed, noteMode) {
    const ctx = this.ctx;
    const t = gameState.currentTime;
    const timeWin = 3.6 / scrollSpeed;
    const notes = gameState.chart.notes;

    for (const note of notes) {
      if (note.hitState === 'hit' && note.type === 'tap') continue;
      if (note.hitState === 'miss') continue;

      const td = note.time - t;
      if (td > timeWin) continue;
      if (td < -0.4 && note.type !== 'hold') continue;

      const prog = 1.0 - (td / timeWin);
      const isRoll = note.type === 'roll';

      if (note.type === 'tap' || isRoll) {
        if (prog < 0 || prog > 1.25) continue;
        const pos = this._lanePos(note.lane, laneCount, prog, g);
        const col = this.laneColors[note.lane % this.laneColors.length];
        const nh = Math.max(8, 16 * prog);
        const nw = pos.lw * (isRoll ? 0.72 : 0.88);

        ctx.save();
        this._rrect(pos.xC - nw/2, pos.y - nh/2, nw, nh, 6);
        ctx.fillStyle = isRoll ? col + 'cc' : col;
        ctx.shadowColor = col; ctx.shadowBlur = isRoll ? 12 : 16;
        ctx.fill();

        // Inner bright stripe
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        this._rrect(pos.xC - nw*0.28, pos.y - nh*0.22, nw*0.56, nh*0.44, 3);
        ctx.fill();

        // Roll indicator (dashed inner border)
        if (isRoll) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4,4]);
          this._rrect(pos.xC - nw/2 + 2, pos.y - nh/2 + 2, nw-4, nh-4, 5);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        ctx.restore();

      } else if (note.type === 'hold') {
        const endProg = 1.0 - ((note.time + note.duration - t) / timeWin);
        if (prog < -0.2 && endProg < 0) continue;
        if (prog > 1.25 && endProg > 1.25) continue;

        const pos = this._lanePos(note.lane, laneCount, Math.min(1.25, Math.max(0, prog)), g);
        const endPos = this._lanePos(note.lane, laneCount, Math.min(1.25, Math.max(0, endProg)), g);
        const col = this.laneColors[note.lane % this.laneColors.length];

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(pos.xC - pos.lw*0.32, pos.y);
        ctx.lineTo(pos.xC + pos.lw*0.32, pos.y);
        ctx.lineTo(endPos.xC + endPos.lw*0.32, endPos.y);
        ctx.lineTo(endPos.xC - endPos.lw*0.32, endPos.y);
        ctx.closePath();
        const hg = ctx.createLinearGradient(0, pos.y, 0, endPos.y);
        hg.addColorStop(0, col + 'cc');
        hg.addColorStop(1, col + '3a');
        ctx.fillStyle = hg;
        ctx.shadowColor = col; ctx.shadowBlur = 10;
        ctx.fill();
        ctx.restore();

        // Head marker
        if (prog <= 1.02) {
          ctx.save();
          this._rrect(pos.xC - pos.lw*0.42, pos.y-6, pos.lw*0.84, 12, 4);
          ctx.fillStyle = '#fff';
          ctx.shadowColor = col; ctx.shadowBlur = 20;
          ctx.fill();
          ctx.restore();
        }
      }
    }
  }

  spawnHitParticles(lane, laneCount, quality) {
    const g = this._trackGeom();
    const pos = this._lanePos(lane, laneCount, 1.0, g);
    const col = this.laneColors[lane % this.laneColors.length];
    const n = quality === 'perfect' ? 24 : 14;

    for (let i = 0; i < n; i++) {
      const angle = Math.PI + Math.random() * Math.PI;
      const speed = Math.random() * 7 + 2;
      const drift = (Math.random() - 0.5) * 2.2;
      this.particles.push({
        x: pos.xC, y: g.botY,
        vx: Math.cos(angle) * speed + drift,
        vy: Math.sin(angle) * speed - 0.6,
        r: Math.random() * 4 + 2,
        color: quality === 'perfect' ? '#ffffff' : col,
        alpha: 1.0,
        decay: Math.random() * 0.04 + 0.02
      });
    }
  }

  _drawParticles() {
    const ctx = this.ctx;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.2;
      p.alpha -= p.decay;
      if (p.alpha <= 0) { this.particles.splice(i,1); continue; }

      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color; ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
    }
  }
}

window.Renderer = Renderer;
