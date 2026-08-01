/**
 * Renderer - Canvas 2.5D Perspective Rhythm Game Engine & Extended Visual Horizon
 */
class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    
    this.width = 0;
    this.height = 0;
    this.particles = [];

    this.laneColors = [
      '#00f5d4', // Cyan
      '#3a86ff', // Blue
      '#f72585', // Pink
      '#ffee32', // Yellow
      '#7b2cbf', // Purple
      '#ff9e00'  // Orange
    ];

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    if (!this.canvas) return;
    this.width = window.innerWidth;
    this.height = Math.max(300, window.innerHeight - 60);
    this.canvas.width = this.width;
    this.canvas.height = this.height;
  }

  drawRoundRectPath(x, y, w, h, r) {
    const ctx = this.ctx;
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  render(gameState, settings, keyStates) {
    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, this.width, this.height);

    const laneCount = (gameState && gameState.settings && gameState.settings.laneCount) || 4;
    const scrollSpeed = (settings && settings.scrollSpeed) || 1.8;

    const perspectiveTop = this.height * 0.12;
    const perspectiveBottom = this.height * 0.88;

    const topWidth = Math.min(this.width * 0.32, 300);
    const bottomWidth = Math.min(this.width * 0.68, 700);

    const centerX = this.width / 2;

    const trackTopLeft = centerX - topWidth / 2;
    const trackTopRight = centerX + topWidth / 2;
    const trackBottomLeft = centerX - bottomWidth / 2;
    const trackBottomRight = centerX + bottomWidth / 2;

    this.drawTrack(trackTopLeft, trackTopRight, trackBottomLeft, trackBottomRight, perspectiveTop, perspectiveBottom, laneCount, keyStates);
    this.drawJudgmentLine(trackBottomLeft, trackBottomRight, perspectiveBottom, laneCount, keyStates);

    if (gameState && gameState.chart && gameState.chart.notes) {
      this.drawNotes(gameState, perspectiveTop, perspectiveBottom, trackTopLeft, trackTopRight, trackBottomLeft, trackBottomRight, laneCount, scrollSpeed);
    }

    this.drawParticles();
  }

  getPerspectivePos(lane, laneCount, progress, trackTopLeft, trackTopRight, trackBottomLeft, trackBottomRight, perspectiveTop, perspectiveBottom) {
    const y = perspectiveTop + progress * (perspectiveBottom - perspectiveTop);

    const currentLeft = trackTopLeft + progress * (trackBottomLeft - trackTopLeft);
    const currentRight = trackTopRight + progress * (trackBottomRight - trackTopRight);
    const currentTrackWidth = currentRight - currentLeft;

    const laneWidth = currentTrackWidth / laneCount;
    const xLeft = currentLeft + lane * laneWidth;
    const xRight = xLeft + laneWidth;
    const xCenter = (xLeft + xRight) / 2;

    return { y, xLeft, xRight, xCenter, laneWidth };
  }

  drawTrack(topLeftX, topRightX, bottomLeftX, bottomRightX, topY, bottomY, laneCount, keyStates) {
    const ctx = this.ctx;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(topLeftX, topY);
    ctx.lineTo(topRightX, topY);
    ctx.lineTo(bottomRightX, bottomY);
    ctx.lineTo(bottomLeftX, bottomY);
    ctx.closePath();

    const trackGrad = ctx.createLinearGradient(0, topY, 0, bottomY);
    trackGrad.addColorStop(0, 'rgba(10, 8, 25, 0.4)');
    trackGrad.addColorStop(0.5, 'rgba(18, 14, 42, 0.7)');
    trackGrad.addColorStop(1, 'rgba(25, 18, 55, 0.85)');
    ctx.fillStyle = trackGrad;
    ctx.fill();

    ctx.strokeStyle = 'rgba(157, 78, 221, 0.6)';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#9d4edd';
    ctx.shadowBlur = 15;
    ctx.stroke();
    ctx.restore();

    for (let i = 0; i <= laneCount; i++) {
      const topX = topLeftX + (i / laneCount) * (topRightX - topLeftX);
      const bottomX = bottomLeftX + (i / laneCount) * (bottomRightX - bottomLeftX);

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(topX, topY);
      ctx.lineTo(bottomX, bottomY);
      ctx.strokeStyle = i === 0 || i === laneCount ? 'rgba(255, 255, 255, 0.4)' : 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = i === 0 || i === laneCount ? 2 : 1;
      ctx.stroke();
      ctx.restore();

      if (i < laneCount && keyStates && keyStates[i]) {
        const laneTopLeft = topLeftX + (i / laneCount) * (topRightX - topLeftX);
        const laneTopRight = topLeftX + ((i + 1) / laneCount) * (topRightX - topLeftX);
        const laneBottomLeft = bottomLeftX + (i / laneCount) * (bottomRightX - bottomLeftX);
        const laneBottomRight = bottomLeftX + ((i + 1) / laneCount) * (bottomRightX - bottomLeftX);

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(laneTopLeft, topY);
        ctx.lineTo(laneTopRight, topY);
        ctx.lineTo(laneBottomRight, bottomY);
        ctx.lineTo(laneBottomLeft, bottomY);
        ctx.closePath();

        const color = this.laneColors[i % this.laneColors.length];
        const beamGrad = ctx.createLinearGradient(0, topY, 0, bottomY);
        beamGrad.addColorStop(0, 'rgba(0,0,0,0)');
        beamGrad.addColorStop(0.7, color + '22');
        beamGrad.addColorStop(1, color + '66');

        ctx.fillStyle = beamGrad;
        ctx.fill();
        ctx.restore();
      }
    }
  }

  drawJudgmentLine(bottomLeftX, bottomRightX, bottomY, laneCount, keyStates) {
    const ctx = this.ctx;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(bottomLeftX - 20, bottomY);
    ctx.lineTo(bottomRightX + 20, bottomY);

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.shadowColor = '#00f5d4';
    ctx.shadowBlur = 20;
    ctx.stroke();
    ctx.restore();

    for (let i = 0; i < laneCount; i++) {
      const pos = this.getPerspectivePos(i, laneCount, 1.0, 0, 0, bottomLeftX, bottomRightX, 0, bottomY);
      const isPressed = keyStates && keyStates[i];

      ctx.save();
      ctx.beginPath();
      ctx.ellipse(pos.xCenter, bottomY, pos.laneWidth * 0.42, 8, 0, 0, Math.PI * 2);

      const color = this.laneColors[i % this.laneColors.length];
      if (isPressed) {
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 30;
      } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.fill();
      ctx.restore();
    }
  }

  drawNotes(gameState, topY, bottomY, topLeftX, topRightX, bottomLeftX, bottomRightX, laneCount, scrollSpeed) {
    const ctx = this.ctx;
    const currentTime = gameState.currentTime;

    // Expanded time horizon to allow comfortable reaction time
    const timeWindow = 3.6 / scrollSpeed; 

    const notes = gameState.chart.notes;

    for (let i = 0; i < notes.length; i++) {
      const note = notes[i];
      if (note.hitState === 'hit' && note.type === 'tap') continue;
      if (note.hitState === 'miss') continue;

      const timeDiff = note.time - currentTime;
      if (timeDiff > timeWindow) continue;
      if (timeDiff < -0.3 && note.type === 'tap') continue;

      const progress = 1.0 - (timeDiff / timeWindow);
      if (progress < 0 || progress > 1.2) continue;

      const pos = this.getPerspectivePos(note.lane, laneCount, progress, topLeftX, topRightX, bottomLeftX, bottomRightX, topY, bottomY);
      const color = this.laneColors[note.lane % this.laneColors.length];

      if (note.type === 'tap') {
        const noteHeight = Math.max(8, 16 * progress);
        const noteWidth = pos.laneWidth * 0.88;

        ctx.save();
        this.drawRoundRectPath(pos.xCenter - noteWidth / 2, pos.y - noteHeight / 2, noteWidth, noteHeight, 6);

        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 15;
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        this.drawRoundRectPath(pos.xCenter - noteWidth * 0.3, pos.y - noteHeight * 0.25, noteWidth * 0.6, noteHeight * 0.5, 3);
        ctx.fill();

        ctx.restore();
      } else if (note.type === 'hold') {
        const endProgress = 1.0 - ((note.time + note.duration - currentTime) / timeWindow);
        const startPos = pos;
        const endPos = this.getPerspectivePos(note.lane, laneCount, Math.max(0, endProgress), topLeftX, topRightX, bottomLeftX, bottomRightX, topY, bottomY);

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(startPos.xCenter - startPos.laneWidth * 0.35, startPos.y);
        ctx.lineTo(startPos.xCenter + startPos.laneWidth * 0.35, startPos.y);
        ctx.lineTo(endPos.xCenter + endPos.laneWidth * 0.35, endPos.y);
        ctx.lineTo(endPos.xCenter - endPos.laneWidth * 0.35, endPos.y);
        ctx.closePath();

        const holdGrad = ctx.createLinearGradient(0, startPos.y, 0, endPos.y);
        holdGrad.addColorStop(0, color + 'cc');
        holdGrad.addColorStop(1, color + '44');

        ctx.fillStyle = holdGrad;
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.restore();

        if (progress <= 1.0) {
          ctx.save();
          this.drawRoundRectPath(startPos.xCenter - startPos.laneWidth * 0.44, startPos.y - 6, startPos.laneWidth * 0.88, 12, 4);
          ctx.fillStyle = '#ffffff';
          ctx.shadowColor = color;
          ctx.shadowBlur = 20;
          ctx.fill();
          ctx.restore();
        }
      }
    }
  }

  spawnHitParticles(lane, laneCount, quality) {
    const bottomY = this.height * 0.88;
    const bottomWidth = Math.min(this.width * 0.68, 700);
    const centerX = this.width / 2;
    const bottomLeftX = centerX - bottomWidth / 2;
    const bottomRightX = centerX + bottomWidth / 2;

    const pos = this.getPerspectivePos(lane, laneCount, 1.0, 0, 0, bottomLeftX, bottomRightX, 0, bottomY);
    const color = this.laneColors[lane % this.laneColors.length];

    const particleCount = quality === 'perfect' ? 24 : 14;

    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.random() * Math.PI) + Math.PI;
      const speed = Math.random() * 8 + 3;

      this.particles.push({
        x: pos.xCenter,
        y: bottomY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: Math.random() * 4 + 2,
        color: quality === 'perfect' ? '#ffffff' : color,
        alpha: 1.0,
        decay: Math.random() * 0.04 + 0.02
      });
    }
  }

  drawParticles() {
    const ctx = this.ctx;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.2;
      p.alpha -= p.decay;

      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

window.Renderer = Renderer;
