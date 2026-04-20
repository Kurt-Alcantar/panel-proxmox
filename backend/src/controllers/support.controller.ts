import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { AuthGuard } from '../guards/auth.guard'
import { JiraService } from '../services/jira.service'

@Controller('support')
@UseGuards(AuthGuard)
export class SupportController {
  constructor(private readonly jira: JiraService) {}

  @Get('meta')
  async meta() {
    return this.jira.getMeta()
  }

  @Get('tickets')
  async list(@Query('search') search?: string, @Query('status') status?: string) {
    return this.jira.listTickets(search, status)
  }

  @Get('tickets/:key')
  async detail(@Param('key') key: string) {
    return this.jira.getTicket(key)
  }

  @Post('tickets')
  async create(@Body() body: any) {
    if (!body?.title) throw new BadRequestException('title es requerido')
    return this.jira.createTicket({
      title: body.title,
      description: body.description,
      priority: body.priority,
      issueTypeName: body.issueTypeName,
      labels: Array.isArray(body.labels) ? body.labels : [],
    })
  }

  @Patch('tickets/:key/status')
  async transition(@Param('key') key: string, @Body() body: any) {
    if (!body?.transitionId) throw new BadRequestException('transitionId es requerido')
    return this.jira.transitionTicket(key, String(body.transitionId))
  }

  @Post('tickets/:key/comment')
  async addComment(@Param('key') key: string, @Body() body: any) {
    if (!body?.comment) throw new BadRequestException('comment es requerido')
    return this.jira.addComment(key, String(body.comment))
  }
}
