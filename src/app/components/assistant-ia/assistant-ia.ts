import { Component, PLATFORM_ID, inject, output, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IaService, IaAction, IaReply, ChatTurn, Proposition } from '../../services/ia.service';
import { ProduitService } from '../../services/produit.service';

interface Msg extends ChatTurn {
  actions?: IaAction[];
  lang?: string;
  proposition?: Proposition;
}

@Component({
  selector: 'app-assistant-ia',
  standalone: true,
  imports: [FormsModule],
  template: `
 
<div class="assistant-card">

  <!-- Header -->
  <header class="assistant-header">
    <div class="assistant-brand">
      <div class="assistant-avatar">
        <span>✳</span>
      </div>

      <div class="assistant-heading">
        <h2>SmartFood Assistant</h2>
        <p>
          <span class="status-dot"></span>
          Votre assistant anti-gaspillage
        </p>
      </div>
    </div>

    <div class="assistant-header-actions">
      <span class="ai-badge">IA ACTIVE</span>
      <button
        type="button"
        class="icon-button"
        title="Nouvelle conversation"
        (click)="messages.set([]); pending.set(null); erreur.set('')">
        ↻
      </button>
    </div>
  </header>

  <!-- Conversation -->
  <main class="assistant-conversation">

    @if (messages().length === 0) {
      <div class="welcome-panel">
        <div class="welcome-icon">✳</div>

        <span class="welcome-label">VOTRE ASSISTANT INTELLIGENT</span>

        <h3>Bonjour ! Que puis-je faire pour vous ?</h3>

        <p>
          Gérez vos stocks, surveillez les dates d'expiration
          et réduisez le gaspillage alimentaire.
        </p>

        <div class="suggestions">
          <button type="button"
            (click)="question.set('Quels produits expirent bientôt ?'); envoyer()">
            <span>◷</span>
            Produits bientôt expirés
          </button>

          <button type="button"
            (click)="question.set('Affiche-moi les produits en stock'); envoyer()">
            <span>▤</span>
            Consulter le stock
          </button>

          <button type="button"
            (click)="question.set('Comment réduire le gaspillage alimentaire ?'); envoyer()">
            <span>✧</span>
            Conseils anti-gaspillage
          </button>

          <button type="button"
            (click)="question.set('Je veux ajouter un produit au stock'); envoyer()">
            <span>＋</span>
            Ajouter un produit
          </button>
        </div>
      </div>
    }

    @for (m of messages(); track $index) {
      <article class="message-row"
        [class.user-row]="m.role === 'user'">

        @if (m.role === 'assistant') {
          <div class="message-avatar">✳</div>
        }

        <div class="message-content">
          <div class="message-meta">
            <span>{{ m.role === 'user' ? 'Vous' : 'SmartFood AI' }}</span>
            @if (m.role === 'assistant') {
              <span class="verified">●</span>
            }
          </div>

          <div class="message-bubble">
            <p>{{ m.content }}</p>

            @if (m.actions?.length) {
              <ul class="action-list">
                @for (a of m.actions; track $index) {
                  <li [class.ecarter]="a.type === 'Écarter'">
                    <b>{{ a.type }}</b>
                    <span>{{ a.produit }}</span>
                    @if (a.raison) {
                      <small>{{ a.raison }}</small>
                    }
                  </li>
                }
              </ul>
            }

            @if (m.proposition && pending() === m.proposition) {
              <div class="product-confirm">
                <div class="confirm-title">
                  <span class="confirm-icon">＋</span>
                  <div>
                    <strong>Confirmer l'ajout</strong>
                    <small>{{ m.proposition.nom }}</small>
                  </div>
                </div>

                <div class="confirm-details">
                  <span>Quantité</span>
                  <strong>
                    {{ m.proposition.quantite }}
                    {{ m.proposition.unite }}
                  </strong>
                  <span>Catégorie</span>
                  <strong>{{ m.proposition.categorie }}</strong>
                </div>

                <div class="confirm-buttons">
                  <button type="button"
                    class="confirm-btn"
                    [disabled]="chargement()"
                    (click)="confirmerProposition()">
                    Confirmer
                  </button>

                  <button type="button"
                    class="cancel-btn"
                    [disabled]="chargement()"
                    (click)="annulerProposition()">
                    Annuler
                  </button>
                </div>
              </div>
            }
          </div>

          @if (m.role === 'assistant') {
            <button type="button" class="speak-btn"
              (click)="parler(m.content, m.lang)">
              <span>♫</span> Écouter la réponse
            </button>
          }
        </div>
      </article>
    }

    @if (chargement()) {
      <div class="typing-row">
        <div class="message-avatar">✳</div>
        <div class="typing-bubble">
          <span></span><span></span><span></span>
          <small>SmartFood réfléchit…</small>
        </div>
      </div>
    }

    @if (erreur()) {
      <div class="error-banner">
        <span>!</span>
        {{ erreur() }}
      </div>
    }
  </main>

  <!-- Composer -->
  <footer class="assistant-footer">
    <div class="composer">
      <input
        [(ngModel)]="question"
        placeholder="Écrivez votre question..."
        (keyup.enter)="envoyer()"
        [disabled]="chargement() || enregistrement()"
        aria-label="Votre question à SmartFood"
      />

      <button type="button"
        class="mic-button"
        [class.recording]="enregistrement()"
        [disabled]="chargement()"
        (click)="toggleMic()"
        [attr.aria-label]="enregistrement() ? 'Arrêter le micro' : 'Parler au microphone'">
        {{ enregistrement() ? '■' : '🎙' }}
      </button>

      <button type="button"
        class="send-button"
        [disabled]="chargement() || enregistrement() || !question().trim()"
        (click)="envoyer()">
        <span>Envoyer</span>
        <span>➤</span>
      </button>
    </div>

    <div class="footer-options">
      <label class="auto-read">
        <input type="checkbox" [(ngModel)]="lectureAuto" />
        <span>Lire les réponses à voix haute</span>
      </label>

      <span class="powered-by">Propulsé par l'IA</span>
    </div>
  </footer>

</div>
 ]`,
 styles: `
:host {
  display: block;
  width: 100%;
  color: #172b22;
  font-family: Inter, "Segoe UI", sans-serif;
}

* {
  box-sizing: border-box;
}

.assistant-card {
  --green: #16834a;
  --green-dark: #11683b;
  --green-soft: #edf8f0;
  --border: #e6ece7;

  width: 100%;
  max-width: 850px;
  margin: 0 auto;
  background: #ffffff;
  border: 1px solid var(--border);
  border-radius: 22px;
  box-shadow: 0 12px 40px rgba(26, 65, 40, 0.08);
  overflow: hidden;
}

/* Header */

.assistant-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 20px 24px;
  border-bottom: 1px solid var(--border);
  background: linear-gradient(120deg, #ffffff, #f6fbf7);
}

.assistant-brand,
.assistant-header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.assistant-avatar,
.message-avatar {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  color: #ffffff;
  background: linear-gradient(145deg, #26a65b, #11683b);
  box-shadow: 0 4px 12px rgba(22, 131, 74, 0.18);
}

.assistant-avatar {
  width: 48px;
  height: 48px;
  border-radius: 16px;
  font-size: 27px;
}

.assistant-heading h2 {
  margin: 0 0 5px;
  font-size: 17px;
  font-weight: 750;
  letter-spacing: -0.4px;
}

.assistant-heading p {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0;
  color: #758278;
  font-size: 12px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #20a464;
  box-shadow: 0 0 0 3px #dff4e6;
}

.ai-badge {
  padding: 7px 10px;
  color: #167442;
  background: #e8f6ed;
  border-radius: 8px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.7px;
}

.icon-button {
  width: 36px;
  height: 36px;
  border: 1px solid var(--border);
  border-radius: 11px;
  background: #fff;
  color: #55705e;
  font-size: 23px;
  cursor: pointer;
  transition: 0.2s;
}

.icon-button:hover {
  color: var(--green);
  background: var(--green-soft);
}

/* Conversation */

.assistant-conversation {
  min-height: 300px;
  max-height: 530px;
  padding: 24px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 22px;
  background:
    radial-gradient(ellipse at top right, #f4faf5 0, transparent 45%),
    #ffffff;
  scroll-behavior: smooth;
}

.welcome-panel {
  max-width: 540px;
  width: 100%;
  margin: 12px auto;
  text-align: center;
}

.welcome-icon {
  width: 66px;
  height: 66px;
  margin: 0 auto 20px;
  display: grid;
  place-items: center;
  border-radius: 22px;
  background: linear-gradient(145deg, #e6f7eb, #ccefd6);
  color: var(--green);
  font-size: 36px;
}

.welcome-label {
  color: var(--green);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 1.5px;
}

.welcome-panel h3 {
  margin: 12px 0 10px;
  font-size: clamp(20px, 3vw, 27px);
  letter-spacing: -0.8px;
}

.welcome-panel > p {
  max-width: 430px;
  margin: 0 auto;
  color: #77847a;
  font-size: 13px;
  line-height: 1.8;
}

.suggestions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 26px;
  text-align: left;
}

.suggestions button {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 54px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 13px;
  color: #334a39;
  background: #ffffff;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s,
    transform 0.2s;
}

.suggestions button span {
  color: var(--green);
  font-size: 19px;
}

.suggestions button:hover {
  border-color: #83c99b;
  background: #f3faf5;
  transform: translateY(-2px);
}

/* Message rows */

.message-row,
.typing-row {
  display: flex;
  align-items: flex-start;
  gap: 11px;
  width: 100%;
  animation: appear 0.2s ease-out;
}

.message-avatar {
  width: 34px;
  height: 34px;
  border-radius: 12px;
  font-size: 19px;
}

.message-content {
  max-width: 82%;
  min-width: 0;
}

.message-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 7px;
  color: #506256;
  font-size: 11px;
  font-weight: 750;
}

.verified {
  color: var(--green);
  font-size: 9px;
}

.message-bubble {
  padding: 13px 16px;
  border: 1px solid #e8eee9;
  border-radius: 4px 16px 16px 16px;
  background: #f6f9f6;
  color: #293b2e;
  font-size: 13px;
  line-height: 1.8;
  overflow-wrap: anywhere;
}

.message-bubble p {
  margin: 0;
  white-space: pre-wrap;
}

.user-row {
  justify-content: flex-end;
}

.user-row .message-content {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.user-row .message-meta {
  justify-content: flex-end;
}

.user-row .message-bubble {
  border-color: #d6e8dc;
  border-radius: 16px 4px 16px 16px;
  background: #eaf6ee;
  color: #214e31;
}

.speak-btn {
  margin-top: 8px;
  padding: 4px 0;
  border: 0;
  background: transparent;
  color: var(--green);
  font-size: 11px;
  cursor: pointer;
}

.speak-btn:hover {
  color: var(--green-dark);
  text-decoration: underline;
}

/* Product confirmation */

.product-confirm {
  margin-top: 14px;
  padding: 15px;
  border: 1px solid #d7eadc;
  border-radius: 13px;
  background: #ffffff;
}

.confirm-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.confirm-icon {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: 10px;
  background: #e8f6ed;
  color: var(--green);
  font-size: 23px;
}

.confirm-title strong,
.confirm-title small {
  display: block;
}

.confirm-title strong {
  font-size: 12px;
}

.confirm-title small {
  margin-top: 3px;
  color: #78877b;
  font-size: 11px;
}

.confirm-details {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin: 15px 0;
  font-size: 11px;
}

.confirm-details span {
  color: #78877b;
}

.confirm-details strong {
  text-align: right;
}

.confirm-buttons {
  display: flex;
  gap: 8px;
}

.confirm-btn,
.cancel-btn {
  flex: 1;
  min-height: 38px;
  padding: 9px 12px;
  border-radius: 9px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.confirm-btn {
  border: 1px solid var(--green);
  background: var(--green);
  color: white;
}

.confirm-btn:hover {
  background: var(--green-dark);
}

.cancel-btn {
  border: 1px solid var(--border);
  background: #ffffff;
  color: #526257;
}

.confirm-btn:disabled,
.cancel-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-list {
  padding-left: 18px;
  margin: 12px 0 0;
}

.action-list li {
  padding: 5px 0;
}

.action-list li b {
  color: var(--green);
  margin-right: 5px;
}

.action-list li small {
  display: block;
  color: #77847a;
}

.action-list li.ecarter b {
  color: #c0392b;
}

/* Typing indicator */

.typing-bubble {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 4px 14px 14px 14px;
  background: #f6f9f6;
}

.typing-bubble > span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--green);
  animation: typing 1s infinite ease-in-out;
}

.typing-bubble > span:nth-child(2) {
  animation-delay: 0.15s;
}

.typing-bubble > span:nth-child(3) {
  animation-delay: 0.3s;
}

.typing-bubble small {
  margin-left: 7px;
  color: #738176;
  font-size: 11px;
}

@keyframes typing {
  0%, 60%, 100% { transform: translateY(0); }
  30% { transform: translateY(-4px); }
}

@keyframes appear {
  from { opacity: 0; transform: translateY(5px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Footer and composer */

.assistant-footer {
  padding: 17px 22px 14px;
  border-top: 1px solid var(--border);
  background: #ffffff;
}

.composer {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 7px;
  border: 1px solid #dfe8e1;
  border-radius: 15px;
  background: #ffffff;
  box-shadow: 0 3px 12px rgba(26, 65, 40, 0.035);
  transition: border-color 0.2s, box-shadow 0.2s;
}

.composer:focus-within {
  border-color: #69b984;
  box-shadow: 0 0 0 3px rgba(22, 131, 74, 0.08);
}

.composer > input {
  flex: 1;
  min-width: 0;
  height: 39px;
  padding: 0 10px;
  border: 0;
  outline: none;
  background: transparent;
  color: #23372a;
  font: inherit;
  font-size: 13px;
}

.composer > input::placeholder {
  color: #9aa69c;
}

.mic-button,
.send-button {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  gap: 8px;
  height: 39px;
  border-radius: 11px;
  cursor: pointer;
  transition: 0.2s;
}

.mic-button {
  width: 40px;
  border: 1px solid #dfe8e1;
  background: #f7faf7;
  color: #42624b;
  font-size: 17px;
}

.mic-button:hover {
  background: #e8f6ed;
}

.mic-button.recording {
  border-color: #dc4646;
  background: #c92d2d;
  color: white;
  animation: pulse 1.3s infinite;
}

@keyframes pulse {
  50% { box-shadow: 0 0 0 5px rgba(201, 45, 45, 0.13); }
}

.send-button {
  padding: 0 15px;
  border: 0;
  background: var(--green);
  color: #ffffff;
  font-size: 12px;
  font-weight: 750;
}

.send-button:hover:not(:disabled) {
  background: var(--green-dark);
  transform: translateY(-1px);
}

.send-button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.footer-options {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  margin-top: 13px;
}

.auto-read {
  display: flex;
  align-items: center;
  gap: 7px;
  color: #728075;
  font-size: 11px;
  cursor: pointer;
}

.auto-read input {
  accent-color: var(--green);
  cursor: pointer;
}

.powered-by {
  color: #a0aaa2;
  font-size: 10px;
}

.error-banner {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 12px;
  border: 1px solid #f3d2ce;
  border-radius: 11px;
  background: #fff5f3;
  color: #a52c22;
  font-size: 12px;
}

.error-banner > span {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #f9dfda;
  font-weight: 800;
}

/* Responsive */

@media (max-width: 600px) {
  .assistant-card {
    border-radius: 16px;
  }

  .assistant-header {
    padding: 15px;
  }

  .assistant-avatar {
    width: 42px;
    height: 42px;
  }

  .assistant-heading h2 {
    font-size: 14px;
  }

  .assistant-heading p {
    font-size: 10px;
  }

  .ai-badge {
    display: none;
  }

  .assistant-conversation {
    min-height: 280px;
    max-height: 460px;
    padding: 16px 12px;
  }

  .message-content {
    max-width: 88%;
  }

  .suggestions {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .suggestions button {
    min-height: 45px;
  }

  .assistant-footer {
    padding: 12px;
  }

  .send-button {
    padding: 0 11px;
  }

  .send-button span:first-child {
    display: none;
  }

  .footer-options {
    align-items: flex-start;
  }

  .auto-read {
    font-size: 10px;
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}`

})
export class AssistantIa {
  private ia = inject(IaService);
  private produitService = inject(ProduitService);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  produitAjoute = output<void>();

  messages = signal<Msg[]>([]);
  question = signal('');
  chargement = signal(false);
  enregistrement = signal(false);
  erreur = signal('');
  lectureAuto = signal(true);
  pending = signal<Proposition | null>(null);

  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];

  private historique(): ChatTurn[] {
    return this.messages().map(({ role, content }) => ({ role, content }));
  }

  // ---------- Texte ----------
  envoyer(): void {
    const q = this.question().trim();
    if (!q || this.chargement()) return;

    const hist = this.historique();
    this.messages.update(m => [...m, { role: 'user', content: q }]);
    this.question.set('');
    this.chargement.set(true);
    this.erreur.set('');

    this.ia.chat(q, hist, !!this.pending()).subscribe({
      next: r => this.traiter(r),
      error: () => this.echec('Assistant indisponible pour le moment.')
    });
  }

  // ---------- Micro ----------
  async toggleMic(): Promise<void> {
    if (!this.isBrowser) return;
    if (this.enregistrement()) {
      this.recorder?.stop();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      this.erreur.set('Micro non pris en charge (utilisez Chrome, en HTTPS ou sur localhost).');
      return;
    }

    try {
      speechSynthesis.cancel();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
        .find(t => MediaRecorder.isTypeSupported(t));
      this.recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      this.chunks = [];

      this.recorder.ondataavailable = e => e.data.size && this.chunks.push(e.data);
      this.recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        this.enregistrement.set(false);
        const blob = new Blob(this.chunks, { type: this.recorder?.mimeType || 'audio/webm' });
        if (blob.size > 0) this.envoyerVocal(blob);
      };

      this.recorder.start();
      this.enregistrement.set(true);
      this.erreur.set('');
    } catch {
      this.erreur.set('Accès au micro refusé. Autorisez-le dans le navigateur.');
    }
  }

  private envoyerVocal(blob: Blob): void {
    const hist = this.historique();
    this.chargement.set(true);

    this.ia.voice(blob, hist, !!this.pending()).subscribe({
      next: r => {
        this.messages.update(m => [...m, { role: 'user', content: r.transcript ?? '' }]);
        this.traiter(r);
      },
      error: err => this.echec(err?.error?.detail ?? 'Transcription indisponible.')
    });
  }

  // ---------- Réponse ----------
  private traiter(r: IaReply): void {
    if (r.confirmation === 'oui') { this.confirmerProposition(); return; }
    if (r.confirmation === 'non') { this.annulerProposition(); return; }
    this.chargement.set(false);
    this.recevoir(r.reply, r.lang, r.actions, r.proposition ?? undefined);
  }

  private recevoir(texte: string, lang = 'fr-FR', actions?: IaAction[], proposition?: Proposition): void {
    this.messages.update(m => [...m, { role: 'assistant', content: texte, actions, lang, proposition }]);
    this.pending.set(proposition ?? null);
    if (this.lectureAuto()) this.parler(texte, lang);
  }

  // ---------- Ajout confirmé : appel de l'API d'ajout ----------
  confirmerProposition(): void {
    const p = this.pending();
    if (!p) { this.chargement.set(false); return; }

    this.chargement.set(true);
    this.produitService.creer({
      nom: p.nom,
      categorie: p.categorie,
      quantite: p.quantite,
      unite: p.unite,
      seuil_alerte: p.seuil_alerte,
      date_expiration: p.date_expiration,
      prix_unitaire: p.prix_unitaire,
      description: "Ajouté via l'assistant",
    }).subscribe({
      next: cree => {
        this.chargement.set(false);
        let txt = `${p.nom} a été ajouté au stock.`;
        if (!p.date_expiration && cree.date_expiration) {
          txt += ` Date limite calculée : ${cree.date_expiration}.`;
        }
        this.recevoir(txt);
        this.produitAjoute.emit();
      },
      error: () => {
        this.chargement.set(false);
        this.erreur.set("L'ajout a échoué. Vérifiez votre connexion et réessayez.");
      }
    });
  }

  annulerProposition(): void {
    this.chargement.set(false);
    this.recevoir("D'accord, rien n'a été ajouté.");
  }

  private echec(msg: string): void {
    this.chargement.set(false);
    this.erreur.set(msg);
  }

  parler(texte: string, lang = 'fr-FR'): void {
    if (!this.isBrowser || !('speechSynthesis' in window) || !texte) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(texte);
    u.lang = lang;
    const voix = speechSynthesis.getVoices().find(v => v.lang.startsWith(lang.slice(0, 2)));
    if (voix) u.voice = voix;
    speechSynthesis.speak(u);
  }
}