import { CommonModule ,isPlatformBrowser } from '@angular/common';
import { Component, OnInit,PLATFORM_ID, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  LucideLayoutDashboard, LucidePackage, LucideBell, LucideHeartHandshake,
  LucideLeaf, LucidePlus, LucideAlertTriangle, LucideArrowRight, LucideX,
  LucideSparkles, LucidePercent, LucideCalendarDays, LucideClipboardList
} from '@lucide/angular';
import { AssistantIa } from '../../components/assistant-ia/assistant-ia';
import {
  ProduitService, ProduitAPI, ProduitCreation,RecoStockage,Alertes
} from '../../services/produit.service';

type ActionType = 'Don' | 'Promotion' | 'Plat du jour';
type ProductStatus = 'Normal' | 'À surveiller' | 'Urgent';

interface Produit {
  id: string;
  nom: string;
  categorie: string;       // libellé affiché
  categorieCode: string;   // code Django
  quantite: number;
  unite: string;           // libellé affiché
  uniteCode: string;       // code Django
  seuilAlerte: number;
  dateLimite: string;      // '' si pas de date
  prix: number;
  description: string;
  statut: ProductStatus;
}

interface Proposition {
  id: number;
  produit: string;
  quantite: number;
  unite: string;
  type: ActionType;
  destinataire: string;
  statut: 'À traiter' | 'Envoyée' | 'Acceptée';
}

const CATEGORIES = [
  { code: 'FRUITS', label: 'Fruits' },
  { code: 'LEGUMES', label: 'Légumes' },
  { code: 'VIANDES', label: 'Viandes' },
  { code: 'POISSONS', label: 'Poissons' },
  { code: 'LAITIERS', label: 'Produits laitiers' },
  { code: 'BOULANGERIE', label: 'Boulangerie' },
  { code: 'AUTRE', label: 'Autre' }
];

const UNITES = [
  { code: 'KG', label: 'kg' },
  { code: 'L', label: 'L' },
  { code: 'PIECE', label: 'pièce' }
];

@Component({
  selector: 'app-chef',
  standalone: true,
  imports: [
    CommonModule, FormsModule,AssistantIa,
    LucideLayoutDashboard, LucidePackage, LucideBell, LucideHeartHandshake,
    LucideLeaf, LucidePlus, LucideAlertTriangle, LucideArrowRight, LucideX,
    LucideSparkles, LucidePercent, LucideCalendarDays, LucideClipboardList
  ],
  templateUrl: './chef.html',
  styleUrl: './chef.css'
})
export class Chef implements OnInit {
  readonly categories = CATEGORIES;
  readonly unites = UNITES;
  private platformId = inject(PLATFORM_ID);
  onglet = 'dashboard';
  recherche = '';
  filtreStatut = 'Tous';
  afficherFormulaire = false;
  message = '';
  chargement = false;
  enregistrement = false;
  erreurBackend = '';


  typeAction: ActionType = 'Don';
  produitSelectionne: string | null = null;
  quantiteAction = 1;

  nouveauProduit = this.produitVide();

  produits: Produit[] = [];

  propositions: Proposition[] = [
    { id: 1, produit: 'Tomates', quantite: 4, unite: 'kg', type: 'Don',
      destinataire: 'Association El Amal', statut: 'Envoyée' },
    { id: 2, produit: 'Lait frais', quantite: 3, unite: 'L', type: 'Promotion',
      destinataire: 'Consommateurs proches', statut: 'À traiter' }
  ];

  constructor(private produitService: ProduitService) {}

  ngOnInit(): void {
  if (isPlatformBrowser(this.platformId)) {
      this.chargerProduits();
    }
  }
  reco: RecoStockage | null = null;
chargementReco = false;
recommander(): void {
  const n = this.nouveauProduit;
  if (!n.nom.trim()) { this.message = 'Saisis d’abord le nom du produit.'; return; }
  this.chargementReco = true;
  this.produitService.recommanderStockage(n.nom.trim(), n.categorie).subscribe({
    next: (r) => { this.reco = r; this.chargementReco = false; },
    error: () => { this.chargementReco = false; this.message = 'Recommandation indisponible.'; }
  });
}

appliquerReco(): void {
  if (!this.reco) return;
  this.nouveauProduit.dateLimite = this.reco.date_expiration_suggeree;
  this.message = 'Date limite remplie selon la recommandation.';
}
  // ---------- Chargement ----------

  chargerProduits(): void {
    this.chargement = true;
    this.erreurBackend = '';

    this.produitService.getProduits().subscribe({
      next: (reponse) => {
        const liste = Array.isArray(reponse) ? reponse : reponse.results;
        this.produits = liste.map(p => this.convertirProduit(p));
        this.chargement = false;
      },
      error: (err) => {
        console.error('Erreur chargement produits :', err);
        this.erreurBackend =
          err.status === 401 || err.status === 403
            ? 'Connecte-toi avec un compte Chef autorisé.'
            : 'Impossible de charger le stock Django.';
        this.chargement = false;
      }
    });
  }

alertesBackend = {
  expires: [] as Produit[],
  proche_expiration: [] as Produit[],
  stock_faible: [] as Produit[],
  total: 0
};

chargementAlertes = false;
erreurAlertes = '';

chargerAlertes(): void {
  this.chargementAlertes = true;
  this.erreurAlertes = '';

  this.produitService.getAlertes().subscribe({
    next: (data: Alertes) => {
      this.alertesBackend = {
        expires: data.expires.map(p => this.convertirProduit(p)),
        proche_expiration: data.proche_expiration.map(
          p => this.convertirProduit(p)
        ),
        stock_faible: data.stock_faible.map(
          p => this.convertirProduit(p)
        ),
        total: data.total
      };

      this.chargementAlertes = false;
    },
    error: (err) => {
      console.error('Erreur chargement alertes :', err);

      this.erreurAlertes =
        err.status === 401 || err.status === 403
          ? 'Connecte-toi avec un compte Chef autorisé.'
          : 'Impossible de charger les alertes depuis Django.';

      this.chargementAlertes = false;
    }
  });
}


changerOnglet(onglet: string): void {
  this.onglet = onglet;
  this.message = '';

  if (onglet === 'alertes') {
    this.chargerAlertes();
  }
}

  private convertirProduit(p: ProduitAPI): Produit {
    const cat = CATEGORIES.find(c => c.code === p.categorie);
    const uni = UNITES.find(u => u.code === p.unite);
    const quantite = Number(p.quantite);
    const seuilAlerte = Number(p.seuil_alerte);
    const dateLimite = p.date_expiration ?? '';

    return {
      id: p.id,
      nom: p.nom,
      categorie: cat?.label ?? 'Autre',
      categorieCode: p.categorie,
      quantite,
      unite: uni?.label ?? p.unite,
      uniteCode: p.unite,
      seuilAlerte,
      dateLimite,
      prix: Number(p.prix_unitaire),
      description: p.description ?? '',
      statut: this.calculerStatut(dateLimite, quantite, seuilAlerte)
    };
  }

  private produitVide() {
    return {
      nom: '',
      categorie: 'LEGUMES',
      quantite: 1,
      unite: 'KG',
      seuilAlerte: 5,
      dateLimite: '',
      prix: 0,
      description: ''
    };
  }

  // ---------- Getters ----------

  get produitsFiltres(): Produit[] {
    return this.produits.filter(p => {
      const correspondRecherche = p.nom.toLowerCase().includes(this.recherche.toLowerCase());
      const correspondStatut = this.filtreStatut === 'Tous' || p.statut === this.filtreStatut;
      const correspondOnglet =
        this.onglet !== 'alertes' || p.statut === 'Urgent' || p.statut === 'À surveiller';
      return correspondRecherche && correspondStatut && correspondOnglet;
    });
  }

  get nombreUrgent(): number {
    return this.produits.filter(p => p.statut === 'Urgent').length;
  }

  get nombreSurveillance(): number {
    return this.produits.filter(p => p.statut === 'À surveiller').length;
  }

  get quantiteTotale(): number {
    return this.produits.reduce((total, p) => total + p.quantite, 0);
  }

  get quantiteProposee(): number {
    return this.propositions
      .filter(p => p.type === 'Don' && p.statut !== 'Acceptée')
      .reduce((total, p) => total + p.quantite, 0);
  }

  get recommandations(): Produit[] {
    return this.produits.filter(p => p.statut !== 'Normal');
  }

  get suggestionIA(): string {
    if (this.recommandations.length === 0) {
      return 'Votre stock semble équilibré. Continuez à surveiller les dates et les quantités.';
    }
    const urgent = this.produits.find(p => p.statut === 'Urgent');
    if (urgent) {
      return `${urgent.nom} nécessite une vérification rapide. Contrôlez sa sécurité alimentaire, puis envisagez une promotion ou un don si le produit est encore propre à la consommation.`;
    }
    return 'Certains produits approchent de leur date limite. Vérifiez les quantités excédentaires et préparez une promotion ou une proposition de don.';
  }

  // ---------- Navigation / formulaire ----------

 

  ouvrirFormulaire(): void {
    this.afficherFormulaire = true;
    this.message = '';
  }

  annulerFormulaire(): void {
    this.afficherFormulaire = false;
    this.nouveauProduit = this.produitVide();
  }

  // ---------- CRUD stock ----------

  ajouterProduit(): void {
    const n = this.nouveauProduit;

    if (!n.nom.trim() || n.quantite < 0 || n.prix < 0 || n.seuilAlerte < 0) {
      this.message = 'Vérifie les champs obligatoires et les quantités.';
      return;
    }

    const aujourdHui = new Date().toISOString().slice(0, 10);
    if (n.dateLimite && n.dateLimite < aujourdHui) {
      this.message = 'La date limite est déjà dépassée.';
      return;
    }

const payload: ProduitCreation = {
  nom: n.nom.trim(),
  categorie: n.categorie,
  quantite: n.quantite,
  unite: n.unite,
  seuil_alerte: n.seuilAlerte,
  date_expiration: n.dateLimite || null,
  prix_unitaire: n.prix,
  description: n.description,
  ...(this.reco && {
    mode_stockage: this.reco.mode_stockage,
    temperature_min: this.reco.temperature_min,
    temperature_max: this.reco.temperature_max,
    duree_conservation_jours: this.reco.duree_conservation_jours,
    consignes_stockage: this.reco.consignes.join('\n'),
    reco_ia: this.reco,
  }),
};

    this.enregistrement = true;
    this.produitService.creer(payload).subscribe({
      next: (cree) => {
        this.produits.unshift(this.convertirProduit(cree));
        this.nouveauProduit = this.produitVide();
        this.afficherFormulaire = false;
        this.enregistrement = false;
        this.onglet = 'stock';
        this.message = 'Produit ajouté au stock avec succès.';
      },
      error: (err) => {
        console.error('Erreur création produit :', err);
        this.enregistrement = false;
        this.message = "Impossible d'ajouter le produit. Vérifie les champs.";
      }
    });
  }

  modifierQuantite(produit: Produit, nouvelleQuantite: number): void {
    if (nouvelleQuantite < 0) {
      this.message = 'La quantité ne peut pas être négative.';
      return;
    }

    this.produitService.modifier(produit.id, { quantite: nouvelleQuantite }).subscribe({
      next: (maj) => {
        const index = this.produits.findIndex(p => p.id === produit.id);
        if (index !== -1) this.produits[index] = this.convertirProduit(maj);
        this.message = `Quantité de ${produit.nom} mise à jour.`;
      },
      error: () => (this.message = 'Impossible de modifier la quantité.')
    });
  }

  supprimerProduit(produit: Produit): void {
    this.produitService.supprimer(produit.id).subscribe({
      next: () => {
        this.produits = this.produits.filter(p => p.id !== produit.id);
        this.message = `${produit.nom} supprimé du stock.`;
      },
      error: () => (this.message = 'Impossible de supprimer le produit.')
    });
  }

  // ---------- Statut (aligné sur le modèle Django) ----------

  calculerStatut(dateLimite: string, quantite: number, seuilAlerte: number): ProductStatus {
    const stockFaible = quantite <= seuilAlerte;

    if (!dateLimite) {
      return stockFaible ? 'À surveiller' : 'Normal';
    }

    const jours = this.joursRestants(dateLimite);

    if (jours <= 2) return 'Urgent';                       // expiré ou ≤ 2 jours
    if (jours <= 5 || stockFaible) return 'À surveiller';
    return 'Normal';
  }

  joursRestants(date: string): number {
    if (!date) return Infinity;
    const aujourdHui = new Date();
    aujourdHui.setHours(0, 0, 0, 0);
    const limite = new Date(date + 'T00:00:00');
    return Math.ceil((limite.getTime() - aujourdHui.getTime()) / 86400000);
  }

  // ---------- Propositions (encore local, étape suivante) ----------

  ouvrirAction(produit: Produit, type: ActionType): void {
    this.produitSelectionne = produit.id;
    this.typeAction = type;
    this.quantiteAction = Math.max(1, Math.min(produit.quantite, Math.ceil(produit.quantite * 0.3)));
    this.onglet = 'partage';
    this.message = '';
  }

  creerProposition(): void {
    const produit = this.produits.find(p => p.id === this.produitSelectionne);

    if (!produit || this.quantiteAction <= 0 || this.quantiteAction > produit.quantite) {
      this.message = 'Choisis un produit et une quantité disponible valide.';
      return;
    }

    this.propositions.unshift({
      id: Date.now(),
      produit: produit.nom,
      quantite: this.quantiteAction,
      unite: produit.unite,
      type: this.typeAction,
      destinataire: this.typeAction === 'Don' ? 'Associations proches' : 'Consommateurs proches',
      statut: 'À traiter'
    });

    this.message = `Proposition de ${this.typeAction.toLowerCase()} créée.`;
    this.produitSelectionne = null;
    this.quantiteAction = 1;
  }

  changerStatut(proposition: Proposition, statut: Proposition['statut']): void {
    proposition.statut = statut;
    this.message = `Statut mis à jour : ${statut}.`;
  }

  // ---------- Classes CSS ----------

  getStatutClass(statut: ProductStatus): string {
    if (statut === 'Urgent') return 'urgent';
    if (statut === 'À surveiller') return 'warning';
    return 'normal';
  }

  getPropositionClass(statut: Proposition['statut']): string {
    if (statut === 'Acceptée') return 'normal';
    if (statut === 'Envoyée') return 'sent';
    return 'warning';
  }
}