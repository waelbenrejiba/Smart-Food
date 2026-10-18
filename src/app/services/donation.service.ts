
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface PropositionDon {
  id: number;
  produit: number;
  produit_nom: string;
  produit_categorie: string;
  produit_unite: string;
  date_expiration: string;
  chef: number;
  chef_email: string;
  association: number | null;
  quantite: number;
  statut: 'DISPONIBLE' | 'ACCEPTEE' | 'ANNULEE' | 'EXPIREE';
  cree_le: string;
  acceptee_le: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class DonationService {
  private readonly url =
    'http://localhost:8000/api/donations/propositions/';

  constructor(private http: HttpClient) {}

  lister(): Observable<any> {
    return this.http.get<any>(this.url);
  }

  accepter(id: number): Observable<any> {
    return this.http.post(
      `${this.url}${id}/accepter/`,
      {}
    );
  }
}
