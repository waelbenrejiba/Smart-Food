
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import {
  DonationOfferResponse,
  DonationOffersService,
} from '../services/donation-offers.service';

import {
  LucideArrowRight,
  LucideBell,
  LucideCheck,
  LucideHeartHandshake,
  LucideLeaf,
  LucideLogOut,
  LucidePackage,
  LucideSearch,
  LucideX,
} from '@lucide/angular';

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
  standalone: true,
  imports: [
    LucideArrowRight,
    LucideBell,
    LucideCheck,
    LucideHeartHandshake,
    LucideLeaf,
    LucideLogOut,
    LucidePackage,
    LucideSearch,
    LucideX,
  ],
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

  readonly pendingCount = computed(
    () => this.offers().filter((offer) => offer.status === 'pending').length
  );

  readonly acceptedCount = computed(
    () => this.offers().filter((offer) => offer.status === 'accepted').length
  );

  readonly urgentCount = computed(
    () =>
      this.offers().filter(
        (offer) =>
          offer.status === 'pending' &&
          this.daysUntil(offer.expirationDate) >= 0 &&
          this.daysUntil(offer.expirationDate) <= 2
      ).length
  );

  readonly filteredOffers = computed(() => {
    const filter = this.activeFilter();
    const search = this.searchTerm().trim().toLocaleLowerCase('fr');

    return this.offers().filter((offer) => {
      const matchesFilter =
        filter === 'all' || offer.status === filter;

      const text =
        `${offer.product} ${offer.category} ` +
        `${offer.restaurant} ${offer.location}`;

      return (
        matchesFilter &&
        text.toLocaleLowerCase('fr').includes(search)
      );
    });
  });

  constructor() {
    this.loadOffers();
  }

  /**
   * Charge les propositions de dons depuis l'API Django.
   */
  loadOffers(): void {
    this.loading.set(true);
    this.loadError.set('');

    this.donationOffersService.list().subscribe({
      next: (offers: DonationOfferResponse[]) => {
        this.offers.set(offers.map((offer) => this.mapOffer(offer)));
        this.loading.set(false);
      },
      error: (error: { status: number }) => {
        this.loading.set(false);
        this.loadError.set(this.apiErrorMessage(error.status));
      },
    });
  }

  setFilter(filter: OfferFilter): void {
    this.activeFilter.set(filter);
  }

  updateSearch(event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      this.searchTerm.set(event.target.value);
    }
  }

  logout(): void {
    this.authService.logout();
    void this.router.navigate(['/login']);
  }

  /**
   * Accepte ou refuse une proposition.
   * L'API Django reste responsable de la validation et des permissions.
   */
  respondToOffer(
    id: number,
    status: 'accepted' | 'refused'
  ): void {
    const offer = this.offers().find((item) => item.id === id);

    if (
      !offer ||
      offer.status !== 'pending' ||
      this.respondingOfferId() !== null
    ) {
      return;
    }

    if (
      typeof window !== 'undefined' &&
      !window.confirm(
        status === 'accepted'
          ? `Confirmer l'acceptation du don « ${offer.product} » ?`
          : `Confirmer le refus du don « ${offer.product} » ?`
      )
    ) {
      return;
    }

    this.respondingOfferId.set(id);
    this.feedback.set('');
    this.loadError.set('');

    this.donationOffersService.respond(id, status).subscribe({
      next: (resultat: unknown) => {
        this.respondingOfferId.set(null);

        if (status === 'accepted') {
          const response = resultat as {
            email_envoye?: boolean;
          };

          this.feedback.set(
            response.email_envoye
              ? `${offer.product} accepté. Le chef a été notifié par email.`
              : `${offer.product} accepté. L'envoi de l'email doit être vérifié.`
          );
        } else {
          this.feedback.set(`${offer.product} refusé.`);
        }

        // Recharge la liste afin de récupérer les statuts réels du serveur.
        this.loadOffers();
      },
      error: (error: { status: number }) => {
        this.respondingOfferId.set(null);
        this.feedback.set('');
        this.loadError.set(this.apiErrorMessage(error.status));
      },
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
      status: offer.status,
    };
  }

  private categoryKey(category: string): string {
    switch (category.trim().toLocaleUpperCase('fr')) {
      case 'FRUITS':
      case 'FRUIT':
        return 'fruit';

      case 'LEGUMES':
      case 'LÉGUMES':
        return 'vegetables';

      case 'POISSONS':
      case 'POISSON':
        return 'fish';

      case 'VIANDES':
      case 'VIANDE':
        return 'meat';

      case 'LAITIERS':
      case 'PRODUITS LAITIERS':
        return 'dairy';

      default:
        return 'other';
    }
  }

  private apiErrorMessage(status: number): string {
    if (status === 0) {
      return 'Impossible de contacter le serveur Django.';
    }

    if (status === 400) {
      return 'Cette proposition n’est plus disponible ou les données sont invalides.';
    }

    if (status === 401) {
      return 'Votre session a expiré. Reconnectez-vous pour consulter les dons.';
    }

    if (status === 403) {
      return 'Cette fonctionnalité est réservée aux comptes association.';
    }

    if (status === 404) {
      return 'Cette proposition n’est plus disponible.';
    }

    if (status === 409) {
      return 'Cette proposition a déjà été traitée.';
    }

    return `Erreur serveur (${status}). Veuillez réessayer.`;
  }

  daysUntil(date: string): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expiration = new Date(`${date}T00:00:00`);

    if (Number.isNaN(expiration.getTime())) {
      return Number.MAX_SAFE_INTEGER;
    }

    return Math.ceil(
      (expiration.getTime() - today.getTime()) / 86400000
    );
  }

  formatDate(date: string): string {
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'short',
    }).format(new Date(`${date}T12:00:00`));
  }

  expiryLabel(date: string): string {
    const days = this.daysUntil(date);

    if (days === Number.MAX_SAFE_INTEGER) {
      return 'Date inconnue';
    }

    if (days < 0) {
      return `Expiré depuis ${Math.abs(days)} jour${days === -1 ? '' : 's'}`;
    }

    if (days === 0) {
      return 'Expire aujourd’hui';
    }

    if (days === 1) {
      return 'Expire demain';
    }

    return `Expire dans ${days} jours`;
  }

  statusLabel(status: OfferStatus): string {
    switch (status) {
      case 'accepted':
        return 'Accepté';
      case 'refused':
        return 'Refusé';
      default:
        return 'À traiter';
    }
  }
}
