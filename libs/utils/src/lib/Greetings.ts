export interface IGreetings {
  getGreetings(): string;
}

export class Greetings implements IGreetings {
  private greeting: string;

  constructor(greeting?: string) {
    this.greeting = greeting ?? 'hello from Greetings';
  }

  getGreetings(): string {
    return this.greeting;
  }
}
