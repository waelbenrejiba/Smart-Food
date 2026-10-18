import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export type DonationOfferStatus = 'pending' | 'accepted' | 'refused';

export interface DonationOfferResponse {
  id: number;
  product: string;
  category: string;
  quantity: number | string;
  unit: string;
  expiration_date: string;
  restaurant: string;
  location: string;
  status: DonationOfferStatus;
}

export interface CreateDonationOffer {
  product: string;
  category: string;
  quantity: number;
  unit: string;
  expiration_date: string;
  location?: string;
}

@Injectable({
  providedIn: 'root'
})
export class DonationOffersService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://127.0.0.1:8000/api/offers/';

  list(): Observable<DonationOfferResponse[]> {
    return this.http.get<DonationOfferResponse[]>(this.apiUrl, {
      headers: this.authorizationHeaders()
    });
  }

  create(offer: CreateDonationOffer): Observable<DonationOfferResponse> {
    return this.http.post<DonationOfferResponse>(this.apiUrl, offer, {
      headers: this.authorizationHeaders()
    });
  }

  respond(id: number, response: Exclude<DonationOfferStatus, 'pending'>): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}${id}/respond/`, {
      status: response
    }, {
      headers: this.authorizationHeaders()
    });
  }

  private authorizationHeaders(): HttpHeaders {
    const token = typeof localStorage === 'undefined'
      ? null
      : localStorage.getItem('access_token');

    return new HttpHeaders({
      Authorization: `Bearer ${token ?? ''}`
    });
  }
}
