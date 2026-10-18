import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ChatTurn { role: 'user' | 'assistant'; content: string; }

export interface IaAction {
  produit: string;
  type: 'Don' | 'Promotion' | 'Plat du jour' | 'Écarter';
  quantite: number | null;
  raison: string;
}

export interface Proposition {
  nom: string;
  categorie: string;
  quantite: number;
  unite: string;
  date_expiration: string | null;
  prix_unitaire: number;
  seuil_alerte: number;
  existant: boolean;
}

export interface IaReply {
  reply: string;
  actions: IaAction[];
  intent: string;
  lang: string;
  transcript?: string;
  proposition?: Proposition | null;
  confirmation?: 'oui' | 'non';
}

@Injectable({ providedIn: 'root' })
export class IaService {
  private base = 'http://localhost:8000/api/ia/';

  constructor(private http: HttpClient) {}

chat(message: string, history: ChatTurn[], pending = false): Observable<IaReply> {
  return this.http.post<IaReply>(`${this.base}chat/`, { message, history, pending });
}

voice(audio: Blob, history: ChatTurn[], pending = false): Observable<IaReply> {
  const ext = audio.type.includes('mp4') ? 'm4a' : audio.type.includes('ogg') ? 'ogg' : 'webm';
  const fd = new FormData();
  fd.append('audio', audio, `voice.${ext}`);
  fd.append('history', JSON.stringify(history));
  fd.append('pending', pending ? '1' : '0');
  return this.http.post<IaReply>(`${this.base}voice/`, fd);
}
}