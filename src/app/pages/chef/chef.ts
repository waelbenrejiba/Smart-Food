
import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  LucideLayoutDashboard,
  LucidePackage,
  LucideBell,
  LucideHeartHandshake,
  LucideLeaf,
  LucidePlus,
  LucideAlertTriangle,
  LucideArrowRight,
  LucideX,
  LucideSparkles,
  LucidePercent,
  LucideCalendarDays,
  LucideClipboardList
} from '@lucide/angular';

type Category = 'Fruits' | 'Légumes' | 'Viandes' | 'Produits laitiers' | 'Autres';
type ActionType = 'Don' | 'Promotion' | 'Plat du jour';
type ProductStatus = 'Normal' | 'À surveiller' | 'Urgent';

interface Produit {
  id: number;
  nom: string;
  categorie: Category;
  quantite: number;
  unite: string;
  dateAchat: string;
  dateLimite: string;
  consommationJournaliere: number;
  prix: number;
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

@Component({
  selector: 'app-chef',
  standalone: true,
  imports: [ CommonModule,
  FormsModule,
  LucideLayoutDashboard,
  LucidePackage,
  LucideBell,
  LucideHeartHandshake,
  LucideLeaf,
  LucidePlus,
  LucideAlertTriangle,
  LucideArrowRight,
  LucideX,
  LucideSparkles,
  LucidePercent,
  LucideCalendarDays,
  LucideClipboardList,],
  templateUrl: './chef.html',
  styleUrl: './chef.css'
})
export class Chef {
  onglet = 'dashboard';
  recherche = '';
  filtreStatut = 'Tous';
  afficherFormulaire = false;
  message = '';
  typeAction: ActionType = 'Don';
  produitSelectionne: number | null = null;
  quantiteAction = 1;

  nouveauProduit = {
    nom: '',
    categorie: 'Légumes' as Category,
    quantite: 1,
    unite: 'kg',
    dateAchat: new Date().toISOString().slice(0, 10),
    dateLimite: '',
    consommationJournaliere: 1,
    prix: 0
  };

  produits: Produit[] = [
    {
      id: 1, nom: 'Tomates', categorie: 'Légumes', quantite: 12,
      unite: 'kg', dateAchat: '2026-10-15', dateLimite: '2026-10-20',
      consommationJournaliere: 2, prix: 3.5, statut: 'À surveiller'
    },
    {
      id: 2, nom: 'Pommes', categorie: 'Fruits', quantite: 8,
      unite: 'kg', dateAchat: '2026-10-14', dateLimite: '2026-10-25',
      consommationJournaliere: 1.5, prix: 4, statut: 'Normal'
    },
    {
      id: 3, nom: 'Lait frais', categorie: 'Produits laitiers', quantite: 10,
      unite: 'L', dateAchat: '2026-10-15', dateLimite: '2026-10-18',
      consommationJournaliere: 2, prix: 2, statut: 'Urgent'
    },
    {
      id: 4, nom: 'Courgettes', categorie: 'Légumes', quantite: 15,
      unite: 'kg', dateAchat: '2026-10-16', dateLimite: '2026-10-23',
      consommationJournaliere: 3, prix: 2.8, statut: 'Normal'
    }
  ];

  propositions: Proposition[] = [
    {
      id: 1, produit: 'Tomates', quantite: 4, unite: 'kg',
      type: 'Don', destinataire: 'Association El Amal', statut: 'Envoyée'
    },
    {
      id: 2, produit: 'Lait frais', quantite: 3, unite: 'L',
      type: 'Promotion', destinataire: 'Consommateurs proches', statut: 'À traiter'
    }
  ];

  get produitsFiltres(): Produit[] {
    return this.produits.filter(p => {
      const correspondRecherche = p.nom.toLowerCase().includes(this.recherche.toLowerCase());
      const correspondStatut = this.filtreStatut === 'Tous' || p.statut === this.filtreStatut;
      const correspondOnglet =
        this.onglet !== 'alertes' ||
        p.statut === 'Urgent' ||
        p.statut === 'À surveiller';

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

  changerOnglet(onglet: string): void {
    this.onglet = onglet;
    this.message = '';
  }

  ouvrirFormulaire(): void {
    this.afficherFormulaire = true;
    this.message = '';
  }

  annulerFormulaire(): void {
    this.afficherFormulaire = false;
  }

  ajouterProduit(): void {
    if (
      !this.nouveauProduit.nom.trim() ||
      !this.nouveauProduit.dateLimite ||
      this.nouveauProduit.quantite <= 0 ||
      this.nouveauProduit.prix < 0 ||
      this.nouveauProduit.consommationJournaliere < 0
    ) {
      this.message = 'Vérifie les champs obligatoires et les quantités.';
      return;
    }

    if (this.nouveauProduit.dateLimite < this.nouveauProduit.dateAchat) {
      this.message = 'La date limite ne peut pas précéder la date d’achat.';
      return;
    }

    const produit: Produit = {
      ...this.nouveauProduit,
      id: Date.now(),
      statut: this.calculerStatut(
        this.nouveauProduit.dateLimite,
        this.nouveauProduit.quantite,
        this.nouveauProduit.consommationJournaliere
      )
    };

    this.produits.unshift(produit);
    this.nouveauProduit = {
      nom: '',
      categorie: 'Légumes',
      quantite: 1,
      unite: 'kg',
      dateAchat: new Date().toISOString().slice(0, 10),
      dateLimite: '',
      consommationJournaliere: 1,
      prix: 0
    };
    this.afficherFormulaire = false;
    this.onglet = 'stock';
    this.message = 'Produit ajouté au stock avec succès.';
  }

  calculerStatut(dateLimite: string, quantite: number, consommation: number): ProductStatus {
    const aujourdHui = new Date();
    aujourdHui.setHours(0, 0, 0, 0);

    const limite = new Date(dateLimite + 'T00:00:00');
    const joursRestants = Math.ceil(
      (limite.getTime() - aujourdHui.getTime()) / 86400000
    );
    const joursPourEcouler = consommation > 0
      ? quantite / consommation
      : Infinity;

    if (joursRestants <= 2 || joursPourEcouler > joursRestants) {
      return 'Urgent';
    }

    if (joursRestants <= 5 || joursPourEcouler > joursRestants - 2) {
      return 'À surveiller';
    }

    return 'Normal';
  }

  joursRestants(date: string): number {
    const aujourdHui = new Date();
    aujourdHui.setHours(0, 0, 0, 0);
    const limite = new Date(date + 'T00:00:00');

    return Math.ceil((limite.getTime() - aujourdHui.getTime()) / 86400000);
  }

  ouvrirAction(produit: Produit, type: ActionType): void {
    this.produitSelectionne = produit.id;
    this.typeAction = type;
    this.quantiteAction = Math.max(
      1,
      Math.min(produit.quantite, Math.ceil(produit.quantite * 0.3))
    );
    this.onglet = 'partage';
    this.message = '';
  }

  creerProposition(): void {
    const produit = this.produits.find(p => p.id === this.produitSelectionne);

    if (!produit || this.quantiteAction <= 0 || this.quantiteAction > produit.quantite) {
      this.message = 'Choisis un produit et une quantité disponible valide.';
      return;
    }

    const destinataire =
      this.typeAction === 'Don'
        ? 'Associations proches'
        : 'Consommateurs proches';

    this.propositions.unshift({
      id: Date.now(),
      produit: produit.nom,
      quantite: this.quantiteAction,
      unite: produit.unite,
      type: this.typeAction,
      destinataire,
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

  supprimerProduit(produit: Produit): void {
    this.produits = this.produits.filter(p => p.id !== produit.id);
    this.message = `${produit.nom} supprimé du stock.`;
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
