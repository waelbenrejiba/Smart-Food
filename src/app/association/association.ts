import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { DonationOfferResponse, DonationOffersService } from '../services/donation-offers.service';
import { LucideArrowRight, LucideBell, LucideCheck, LucideHeartHandshake, LucideLeaf, LucideLogOut, LucidePackage, LucideSearch, LucideX } from '@lucide/angular';

type OfferStatus = 'pending' | 'accepted' | 'refused';
type OfferFilter = 'all' | OfferStatus;

interface DonationOffer {
  id: number;
  product: string;
  category: string;
  categoryKey: string;
  quantity: number;
  unit: string;
  expirationDate: string;
  restaurant: string;
  location: string;
  status: OfferStatus;
}

@Component({
  selector: 'app-association',
  imports: [LucideArrowRight, LucideBell, LucideCheck, LucideHeartHandshake, LucideLeaf, LucideLogOut, LucidePackage, LucideSearch, LucideX],
  templateUrl: './association.html',
  styleUrl: './association.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Association {
  private readonly authService = inject(AuthService);
  private readonly donationOffersService = inject(DonationOffersService);
  private readonly router = inject(Router);

  readonly offers = signal<DonationOffer[]>([]);
  readonly loading = signal(false);
  readonly loadError = signal('');
  readonly respondingOfferId = signal<number | null>(null);

  readonly activeFilter = signal<OfferFilter>('pending');
  readonly searchTerm = signal('');
  readonly feedback = signal('');
  readonly pendingCount = computed(() => this.offers().filter((offer) => offer.status === 'pending').length);
  readonly acceptedCount = computed(() => this.offers().filter((offer) => offer.status === 'accepted').length);
  readonly urgentCount = computed(() => this.offers().filter((offer) => offer.status === 'pending' && this.daysUntil(offer.expirationDate) <= 2).length);
  readonly filteredOffers = computed(() => {
    const filter = this.activeFilter();
    const search = this.searchTerm().trim().toLocaleLowerCase('fr');
    return this.offers().filter((offer) => {
      const matchesFilter = filter === 'all' || offer.status === filter;
      const text = `${offer.product} ${offer.category} ${offer.restaurant} ${offer.location}`;
      return matchesFilter && text.toLocaleLowerCase('fr').includes(search);
    });
  });

  constructor() {
    if (typeof localStorage !== 'undefined') this.loadOffers();
  }

  loadOffers(): void {
    this.loading.set(true);
    this.loadError.set('');
    this.donationOffersService.list().subscribe({
      next: (offers) => {
        this.offers.set(offers.map((offer) => this.mapOffer(offer)));
        this.loading.set(false);
      },
      error: (error: { status: number }) => {
        this.loading.set(false);
        this.loadError.set(this.apiErrorMessage(error.status));
      }
    });
  }

  setFilter(filter: OfferFilter): void {
    this.activeFilter.set(filter);
  }

  logout(): void {
    this.authService.logout();
    void this.router.navigate(['/login']);
  }

  updateSearch(event: Event): void {
    if (event.target instanceof HTMLInputElement) this.searchTerm.set(event.target.value);
  }

  respondToOffer(id: number, status: 'accepted' | 'refused'): void {
    const offer = this.offers().find((item) => item.id === id);
    if (!offer || offer.status !== 'pending' || this.respondingOfferId() !== null) return;

    this.respondingOfferId.set(id);
    this.feedback.set('');
    this.donationOffersService.respond(id, status).subscribe({
      next: () => {
        this.offers.update((offers) => offers.map((item) => item.id === id ? { ...item, status } : item));
        this.respondingOfferId.set(null);
        this.feedback.set(status === 'accepted'
          ? `${offer.product} accepté. L’envoi attend la validation du chef.`
          : `${offer.product} refusé.`
        );
      },
      error: (error: { status: number }) => {
        this.respondingOfferId.set(null);
        this.feedback.set(this.apiErrorMessage(error.status));
      }
    });
  }

  private mapOffer(offer: DonationOfferResponse): DonationOffer {
    return {
      id: offer.id,
      product: offer.product,
      category: offer.category,
      categoryKey: this.categoryKey(offer.category),
      quantity: Number(offer.quantity),
      unit: offer.unit,
      expirationDate: offer.expiration_date,
      restaurant: offer.restaurant,
      location: offer.location,
      status: offer.status
    };
  }

  private categoryKey(category: string): string {
    switch (category) {
      case 'Produits laitiers': return 'dairy';
      case 'Légumes': return 'vegetables';
      case 'Poissons': return 'fish';
      case 'Fruits': return 'fruit';
      case 'Viandes': return 'meat';
      default: return 'other';
    }
  }

  private apiErrorMessage(status: number): string {
    if (status === 0) return 'Impossible de contacter le serveur Django.';
    if (status === 401) return 'Votre session a expiré. Reconnectez-vous pour consulter les dons.';
    if (status === 403) return 'Cette fonctionnalité est réservée aux comptes association.';
    if (status === 404) return 'Cette proposition n’est plus disponible.';
    return `Erreur serveur (${status}). Veuillez réessayer.`;
  }

  daysUntil(date: string): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.ceil((new Date(`${date}T00:00:00`).getTime() - today.getTime()) / 86400000);
  }

  formatDate(date: string): string {
    return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(new Date(`${date}T12:00:00`));
  }

  expiryLabel(date: string): string {
    const days = this.daysUntil(date);
    if (days < 0) return `Expiré depuis ${Math.abs(days)} jour${days === -1 ? '' : 's'}`;
    if (days === 0) return 'Expire aujourd’hui';
    if (days === 1) return 'Expire demain';
    return `Expire dans ${days} jours`;
  }

  statusLabel(status: OfferStatus): string {
    switch (status) {
      case 'accepted': return 'Accepté · validation du chef';
      case 'refused': return 'Refusé';
      default: return 'À traiter';
    }
  }
}
