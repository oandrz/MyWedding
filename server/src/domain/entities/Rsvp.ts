export class Rsvp {
  constructor(
    public readonly id: number,
    public readonly name: string,
    public readonly email: string,
    public readonly attending: boolean,
    public readonly guestCount: number | null = null
  ) {
    this.validate();
  }

  private validate(): void {
    if (!this.name || this.name.trim().length === 0) {
      throw new Error('RSVP name is required');
    }
    
    if (!this.email || !this.isValidEmail(this.email)) {
      throw new Error('Valid email is required');
    }
    
    if (this.guestCount !== null && this.guestCount < 0) {
      throw new Error('Guest count cannot be negative');
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  getTotalAttendees(): number {
    if (!this.attending) return 0;
    return 1 + (this.guestCount || 0);
  }

  static create(params: Omit<Rsvp, 'id'> & { id?: number }): Rsvp {
    const id = params.id || Date.now();
    return new Rsvp(
      id,
      params.name,
      params.email,
      params.attending,
      params.guestCount
    );
  }
}