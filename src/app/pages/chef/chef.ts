import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

interface Produit {
  id: number;
  nom: string;
  categorie: string;
  quantite: number;
  unite: string;
  peremption: string;
  heureLimite: string;
  prixNormal: number;
  prixPropose: number;
  description: string;
}

interface Demande {
  id: number;
  produit: string;
  association: string;
  quantite: string;
  statut: string;
}

@Component({
  selector: 'app-chef',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chef.html',
  styleUrl: './chef.css'
})
export class Chef {
  page = 'dashboard';
  recherche = '';
  filtreCategorie = 'Toutes';
  message = '';

  categories = [
    'Boulangerie',
    'Fruits et légumes',
    'Produits laitiers',
    'Viandes et poissons',
    'Plats préparés',
    'Autres'
  ];

  produitForm = {
    nom: '',
    categorie: '',
    quantite: 1,
    unite: 'Pièces',
    peremption: '',
    heureLimite: '',
    prixNormal: 0,
    prixPropose: 0,
    description: ''
  };

  dateAujourdhui(): string {
    return this.formatDate(new Date());
  }

  dateDemain(): string {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return this.formatDate(date);
  }

  private formatDate(date: Date): string {
    const annee = date.getFullYear();
    const mois = String(date.getMonth() + 1).padStart(2, '0');
    const jour = String(date.getDate()).padStart(2, '0');

    return `${annee}-${mois}-${jour}`;
  }

  produits: Produit[] = [
    {
      id: 1,
      nom: 'Pain frais',
      categorie: 'Boulangerie',
      quantite: 20,
      unite: 'Pièces',
      peremption: this.dateAujourdhui(),
      heureLimite: '18:00',
      prixNormal: 10,
      prixPropose: 5,
      description: 'Pain frais disponible à récupérer.'
    },
    {
      id: 2,
      nom: 'Fruits frais',
      categorie: 'Fruits et légumes',
      quantite: 5,
      unite: 'Kg',
      peremption: this.dateDemain(),
      heureLimite: '12:00',
      prixNormal: 18,
      prixPropose: 10,
      description: 'Fruits frais en bon état.'
    },
    {
      id: 3,
      nom: 'Yaourts',
      categorie: 'Produits laitiers',
      quantite: 12,
      unite: 'Pièces',
      peremption: this.dateDemain(),
      heureLimite: '17:00',
      prixNormal: 12,
      prixPropose: 6,
      description: 'Produits conservés au frais.'
    }
  ];

  associations = [
    {
      nom: 'Association Solidarité',
      description: 'Collecte et distribution alimentaire',
      telephone: ''
    },
    {
      nom: "Association d'entraide",
      description: 'Aide aux familles',
      telephone: ''
    }
  ];

  demandes: Demande[] = [
    {
      id: 1,
      produit: 'Pain frais',
      association: 'Association Solidarité',
      quantite: '10 pièces',
      statut: 'En attente'
    },
    {
      id: 2,
      produit: 'Fruits frais',
      association: "Association d'entraide",
      quantite: '2 kg',
      statut: 'Acceptée'
    }
  ];

  changerPage(nom: string): void {
    this.page = nom;
    this.message = '';
  }

  ajouterProduit(): void {
    if (
      !this.produitForm.nom.trim() ||
      !this.produitForm.categorie ||
      !this.produitForm.peremption ||
      !this.produitForm.heureLimite ||
      this.produitForm.quantite <= 0 ||
      this.produitForm.prixNormal < 0 ||
      this.produitForm.prixPropose < 0
    ) {
      this.message =
        'Veuillez remplir correctement les champs obligatoires.';
      return;
    }

    const nouveau: Produit = {
      ...this.produitForm,
      id: Date.now(),
      nom: this.produitForm.nom.trim()
    };

    this.produits.unshift(nouveau);

    this.produitForm = {
      nom: '',
      categorie: '',
      quantite: 1,
      unite: 'Pièces',
      peremption: '',
      heureLimite: '',
      prixNormal: 0,
      prixPropose: 0,
      description: ''
    };

    this.message = 'Produit ajouté avec succès.';
    this.page = 'produits';
  }

  supprimerProduit(id: number): void {
    this.produits = this.produits.filter(p => p.id !== id);
    this.message = 'Produit supprimé.';
  }

  get produitsFiltres(): Produit[] {
    return this.produits.filter(p => {
      const nomOK = p.nom
        .toLowerCase()
        .includes(this.recherche.toLowerCase());

      const categorieOK =
        this.filtreCategorie === 'Toutes' ||
        p.categorie === this.filtreCategorie;

      return nomOK && categorieOK;
    });
  }

  get produitsUrgents(): Produit[] {
    return this.produits.filter(
      p => p.peremption <= this.dateAujourdhui()
    );
  }

  get demandesEnAttente(): number {
    return this.demandes.filter(
      d => d.statut === 'En attente'
    ).length;
  }

  get demandesAcceptees(): number {
    return this.demandes.filter(
      d => d.statut === 'Acceptée'
    ).length;
  }

  contacterAssociation(nom: string, telephone: string): void {
    if (!telephone.trim()) {
      this.message =
        `Le numéro de téléphone de ${nom} n'est pas encore renseigné.`;
      return;
    }

    window.open(`tel:${telephone}`, '_self');
  }

  changerStatut(demande: Demande, statut: string): void {
    demande.statut = statut;
    this.message = `Statut modifié : ${statut}.`;
  }

  nouvelleDemande(produit: Produit, association: string): void {
    this.demandes.unshift({
      id: Date.now(),
      produit: produit.nom,
      association,
      quantite: `${produit.quantite} ${produit.unite}`,
      statut: 'En attente'
    });

    this.message = 'Demande ajoutée à la liste.';
    this.page = 'demandes';
  }
}