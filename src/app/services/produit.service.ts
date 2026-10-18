import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ProduitAPI {
  id: string;
  nom: string;
  categorie: string;
  quantite: string | number;
  unite: string;
  seuil_alerte: string | number;
  date_expiration: string | null;
  prix_unitaire: string | number;
  description: string;
  actif: boolean;
  mode_stockage?: string;
  temperature_min?: number | null;
  temperature_max?: number | null;
  duree_conservation_jours?: number | null;
  consignes_stockage?: string;
}

export interface ProduitCreation {
  nom: string;
  categorie: string;
  quantite: number;
  unite: string;
  seuil_alerte: number;
  date_expiration: string | null;
  prix_unitaire: number;
  description: string;
  mode_stockage?: string;
  temperature_min?: number | null;
  temperature_max?: number | null;
  duree_conservation_jours?: number | null;
  consignes_stockage?: string;
  
}

export interface RecoStockage {
  mode_stockage: string;
  temperature_min: number;
  temperature_max: number;
  duree_conservation_jours: number;
  semaines: number;
  date_expiration_suggeree: string;
  consignes: string[];
  signes_deterioration: string[];
  a_eviter: string[];
  astuces_prolonger: string[];
  source: 'ia' | 'regles';
}

export interface Alertes {
  expires: ProduitAPI[];
  proche_expiration: ProduitAPI[];
  stock_faible: ProduitAPI[];
  total: number;
}

@Injectable({ providedIn: 'root' })
export class ProduitService {
  private url = 'http://localhost:8000/api/chef/produits/';

  constructor(private http: HttpClient) {}

  getProduits(): Observable<ProduitAPI[] | { results: ProduitAPI[] }> {
    return this.http.get<ProduitAPI[] | { results: ProduitAPI[] }>(this.url);
  }

  creer(data: ProduitCreation): Observable<ProduitAPI> {
    return this.http.post<ProduitAPI>(this.url, data);
  }

  modifier(id: string, data: Partial<ProduitCreation>): Observable<ProduitAPI> {
    return this.http.patch<ProduitAPI>(`${this.url}${id}/`, data);
  }

  supprimer(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}${id}/`);
  }

  recommanderStockage(nom: string, categorie: string, etat = 'frais'): Observable<RecoStockage> {
    return this.http.post<RecoStockage>(`${this.url}recommandation-stockage/`, { nom, categorie, etat });
  }

  getAlertes(): Observable<Alertes> {
    return this.http.get<Alertes>(`${this.url}alertes/`);
  }
}