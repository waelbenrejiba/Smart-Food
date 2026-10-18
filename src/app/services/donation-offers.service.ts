
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

export type DonationStatus = 'pending' | 'accepted' | 'refused';

interface DjangoDonation {
  id: number;
  produit: number;
  produit_nom: string;
  produit_categorie: string;
  produit_unite: string;
  date_expiration: string;
  chef: number;
  chef_email: string;
  association: number | null;
  quantite: string | number;
  statut: string;
  cree_le: string;
  acceptee_le: string | null;
}

export interface DonationOfferResponse {
  id: number;
  product: string;
  category: string;
  quantity: string | number;
  unit: string;
  expiration_date: string;
  restaurant: string;
  location: string;
  status: DonationStatus;
}

@Injectable({
  providedIn: 'root'
})
export class DonationOffersService {
  private readonly http = inject(HttpClient);

  // URL de base de l'API Django
  private readonly url = 'http://localhost:8000/api';

  // Endpoint des propositions de dons
  private readonly apiUrl = `${this.url}/donations/propositions`;

  list(): Observable<DonationOfferResponse[]> {
    return this.http
      .get<DjangoDonation[] | { results: DjangoDonation[] }>(
        `${this.apiUrl}/`
      )
      .pipe(
        map(response =>
          Array.isArray(response) ? response : response.results
        ),
        map(propositions =>
          propositions.map(item => this.mapDonation(item))
        )
      );
  }

  respond(
    id: number,
    status: 'accepted' | 'refused'
  ): Observable<unknown> {
    const action = status === 'accepted' ? 'accepter' : 'refuser';

    return this.http.post(
      `${this.apiUrl}/${id}/${action}/`,
      {}
    );
  }

  private mapDonation(item: DjangoDonation): DonationOfferResponse {
    let status: DonationStatus;

    switch (item.statut.toUpperCase()) {
      case 'ACCEPTEE':
      case 'ACCEPTE':
      case 'ACCEPTED':
        status = 'accepted';
        break;

      case 'REFUSEE':
      case 'REFUSE':
      case 'REFUSED':
      case 'ANNULEE':
        status = 'refused';
        break;

      default:
        status = 'pending';
    }

    return {
      id: item.id,
      product: item.produit_nom,
      category: item.produit_categorie,
      quantity: item.quantite,
      unit: item.produit_unite,
      expiration_date: item.date_expiration,
      restaurant: item.chef_email || `Chef #${item.chef}`,
      location: '',
      status
    };
  }
}
