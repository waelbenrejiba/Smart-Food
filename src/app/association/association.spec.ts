import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { Association } from './association';

describe('Association', () => {
  let component: Association;
  let fixture: ComponentFixture<Association>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Association],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([])
      ]
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Association);
    component = fixture.componentInstance;
    http.expectOne('http://127.0.0.1:8000/api/offers/').flush([
      {
        id: 1,
        product: 'Tomates',
        category: 'Légumes',
        quantity: '4.00',
        unit: 'kg',
        expiration_date: '2026-10-20',
        restaurant: 'Le Jardin',
        location: 'Hammamet',
        status: 'pending'
      },
      {
        id: 2,
        product: 'Pommes',
        category: 'Fruits',
        quantity: '8.00',
        unit: 'kg',
        expiration_date: '2026-10-25',
        restaurant: 'Dar El Mida',
        location: 'Nabeul',
        status: 'accepted'
      },
      {
        id: 3,
        product: 'Poulet frais',
        category: 'Viandes',
        quantity: '5.00',
        unit: 'kg',
        expiration_date: '2026-10-20',
        restaurant: 'Chez Sami',
        location: 'Hammamet',
        status: 'refused'
      }
    ]);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    http.verify();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('accepts an offer and keeps chef confirmation pending', () => {
    component.respondToOffer(1, 'accepted');

    const request = http.expectOne('http://127.0.0.1:8000/api/offers/1/respond/');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ status: 'accepted' });
    request.flush({ offer_id: 1, status: 'accepted' });

    expect(component.offers().find((offer) => offer.id === 1)?.status).toBe('accepted');
    expect(component.feedback()).toContain('attend la validation du chef');
    expect(component.pendingCount()).toBe(0);
  });

  it('refuses a pending offer', () => {
    component.respondToOffer(1, 'refused');

    const request = http.expectOne('http://127.0.0.1:8000/api/offers/1/respond/');
    request.flush({ offer_id: 1, status: 'refused' });

    expect(component.offers().find((offer) => offer.id === 1)?.status).toBe('refused');
    expect(component.feedback()).toContain('refusé');
  });
});
